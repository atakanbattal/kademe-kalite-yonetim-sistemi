import { format, differenceInDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';
import { toCamelCase, getAttachmentDisplayName, formatDateOnlyLocal } from './utils';
import { normalizeQuarantineAttachments } from './quarantineAttachments';
import { getQuarantineDecisionCertificateStatement } from './quarantineDecisionCertificate';

/** Lot → parça-KT → KT-yıl-6hex (UUID tam metin olarak gösterilmez) */
const getQuarantineDocumentNoValue = (record) => {
	if (!record) return null;
	const lot = String(record.lot_no || '').trim();
	if (lot && lot !== '-') return { label: 'Lot / belge no', value: lot };
	const code = String(record.part_code || '').trim();
	if (code) return { label: 'Belge no', value: `${code}-KT` };
	const y = record.quarantine_date
		? new Date(record.quarantine_date).getFullYear()
		: new Date().getFullYear();
	const id = String(record.id || '').replace(/-/g, '');
	if (id.length >= 6) return { label: 'Takip no', value: `KT-${y}-${id.slice(0, 6).toUpperCase()}` };
	return null;
};
import { getMeasurementFrequencyLabel } from '@/lib/controlPlanMeasurementFrequency';
import { KPI_CATEGORIES } from '@/components/kpi/kpi-definitions';
import {
	stripSquareBullets,
	hasStructuredRootCauseData,
	stripDuplicateRootCauseFromProblemDescription,
} from '@/lib/df8dTextUtils';
import { formatFiveTopicForPdf, FIVE_T_PDF_LABELS } from '@/lib/fmeaFiveTopics';

// Global formatter helpers
const formatDateHelper = (dateStr, style = 'dd.MM.yyyy') => dateStr ? format(new Date(dateStr), style, { locale: tr }) : '-';
const formatDateTimeFull = (dateStr) => dateStr ? format(new Date(dateStr), 'dd MMMM yyyy', { locale: tr }) : '-';
const formatDateTime = (dateStr) => dateStr ? format(new Date(dateStr), 'dd.MM.yyyy HH:mm') : '-';
const formatCurrency = (value) => (value || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
const formatArray = (arr) => Array.isArray(arr) && arr.length > 0 ? arr.join(', ') : '-';

// Logo cache - logoları bir kez yükleyip cache'le
export const logoCache = {};

// Harici URL veya yerel dosyadan görüntüyü base64'e çevir
export const imageUrlToBase64 = async (url) => {
	// Cache'de varsa direkt döndür
	if (logoCache[url]) {
		return logoCache[url];
	}

	try {
		// Yerel dosya için (public klasöründen) veya harici URL için fetch kullan
		const response = await fetch(url, { mode: 'cors' });
		if (!response.ok) {
			console.warn(`Logo yüklenemedi: ${url}`);
			// Yerel dosya yoksa null döndür, harici URL'ler için de null
			return null;
		}
		const blob = await response.blob();
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onloadend = () => {
				const base64 = reader.result;
				logoCache[url] = base64; // Cache'e kaydet
				resolve(base64);
			};
			reader.onerror = reject;
			reader.readAsDataURL(blob);
		});
	} catch (error) {
		console.error(`Logo base64'e çevrilemedi: ${url}`, error);
		return null;
	}
};

// Logo URL'leri - önce yerel dosyadan, yoksa harici URL'den
export const getLogoUrl = (filename) => {
	// Public klasöründen çek (Vite'da public klasörü root'tan erişilebilir)
	return `/${filename}`;
};

// Tüm logoları önceden yükle ve cache'le
export const preloadLogos = async () => {
	// Sadece public klasöründeki logo.png dosyasını kullan
	const logoUrls = [
		getLogoUrl('logo.png'), // Ana Kademe logosu (public klasöründen)
	];

	// Tüm logoları paralel olarak yükle (başarısız olanlar sessizce atlanır)
	await Promise.all(logoUrls.map(async (url) => {
		try {
			await imageUrlToBase64(url);
		} catch (error) {
			console.warn(`Logo yüklenemedi (atlanıyor): ${url}`);
		}
	}));
};

// Türkçe karakterleri korumak için normalize fonksiyonu
const normalizeTurkishChars = (text) => {
	if (!text) return null;
	if (typeof text !== 'string') return text;

	// Unicode normalization ile Türkçe karakterleri düzelt
	const normalized = String(text)
		.normalize('NFC') // Unicode normalization
		.replace(/\u0131/g, 'ı') // dotless i
		.replace(/\u0130/g, 'İ') // dotted I
		.replace(/\u0069\u0307/g, 'i') // i with combining dot
		.replace(/\u0049\u0307/g, 'İ'); // I with combining dot

	return normalized;
};

// Obje içindeki tüm string değerleri normalize et (recursive)
const normalizeRecord = (record) => {
	if (!record || typeof record !== 'object') return record;

	if (Array.isArray(record)) {
		return record.map(item => normalizeRecord(item));
	}

	const normalized = {};
	for (const [key, value] of Object.entries(record)) {
		if (typeof value === 'string') {
			normalized[key] = normalizeTurkishChars(value);
		} else if (typeof value === 'object' && value !== null) {
			normalized[key] = normalizeRecord(value);
		} else {
			normalized[key] = value;
		}
	}
	return normalized;
};

/** PDF/yazdır penceresi dosya adı için: geçersiz karakterleri temizle, kısalt. */
const safeReportTitleSegment = (s, maxLen) => {
	if (s == null || s === '') return '';
	return String(s)
		.slice(0, maxLen)
		.replace(/[/\\?%*:|"<>]/g, '-')
		.replace(/\s+/g, ' ')
		.trim();
};

const escapeHtmlTitle = (str) => {
	if (str == null) return '';
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
};

const openPrintableReport = async (record, type, useUrlParams = false) => {
	if (!record) {
		console.error("openPrintableReport called with invalid record:", record);
		return;
	}

	// Türkçe karakterleri normalize et-tüm raporlar için geçerli
	const normalizedRecord = normalizeRecord(record);

	// Liste tipleri için özel ID kontrolü (id olmasa da devam et)
	const isListType = type.endsWith('_list') || type === 'document_list';
	const hasValidId = normalizedRecord.id || normalizedRecord.delivery_note_number;

	if (!isListType && !hasValidId) {
		console.error("openPrintableReport: record has no valid ID field:", normalizedRecord);
		return;
	}

	const reportId = type === 'sheet_metal_entry'
		? normalizedRecord.delivery_note_number
		: type === 'inkr_management'
			? (normalizedRecord.inkr_number || normalizedRecord.id)
			: (normalizedRecord.id || normalizedRecord.delivery_note_number || `list-${Date.now()}`);

	/**
	 * await / async sonrası window.open çoğu tarayıcıda pencere engeline takılır.
	 * Önce about:blank senkron aç, veri hazır olunca aynı pencerenin location'ına yazdırma URL'ini ver.
	 */
	const reportWindow = window.open('about:blank', '_blank');
	if (!reportWindow) {
		console.warn('Rapor sekmesi açılamadı (açılır pencere engeli olabilir).');
		return;
	}

	const navigateReportWindow = (relativePath) => {
		try {
			reportWindow.location.href = relativePath;
			try {
				reportWindow.focus();
			} catch {
				/* noop */
			}
		} catch (e) {
			console.error('Rapor penceresine yönlendirilemedi:', e);
		}
	};

	// Logo önbelleği — tıklama zincirini bloklamasın; rapor sekmesi kendi bundle'ında da yüklüyor
	void preloadLogos().catch(() => {});

	if (useUrlParams) {
		try {
			// localStorage kullanarak URL limitini aş (tab'ler arası çalışır)
			// Benzersiz bir key oluştur
			const storageKey = `report_${type}_${reportId}_${Date.now()}`;

			// Sapma: Girdi modülü vb. sadece özet alan gönderdiğinde rapor eksik kalmasın — tam kayıt çek
			let recordToStore = normalizedRecord;
			if (type === 'deviation' && normalizedRecord.id) {
				try {
					const { data: fullDeviation, error: fullDevError } = await supabase
						.from('deviations')
						.select(
							'*, deviation_approvals!left(*), deviation_vehicles!left(*), deviation_attachments!left(*)'
						)
						.eq('id', normalizedRecord.id)
						.maybeSingle();

					if (!fullDevError && fullDeviation) {
						recordToStore = normalizeRecord(fullDeviation);
					}
				} catch (fullFetchErr) {
					console.warn('Sapma tam kayıt çekilemedi, gönderilen veri kullanılacak:', fullFetchErr);
				}

				// Yedek: tam sorgu başarısız veya ilişkiler boş kaldıysa parça parça doldur
				if (!recordToStore.deviation_vehicles || recordToStore.deviation_vehicles.length === 0) {
					try {
						const { data: vehiclesData } = await supabase
							.from('deviation_vehicles')
							.select('*')
							.eq('deviation_id', normalizedRecord.id);
						if (vehiclesData && vehiclesData.length > 0) {
							recordToStore = { ...recordToStore, deviation_vehicles: normalizeRecord(vehiclesData) };
						}
					} catch (vehiclesError) {
						console.warn('Deviation vehicles çekilemedi:', vehiclesError);
					}
				}

				if (!recordToStore.deviation_attachments || recordToStore.deviation_attachments.length === 0) {
					try {
						const { data: attachmentsData } = await supabase
							.from('deviation_attachments')
							.select('*')
							.eq('deviation_id', normalizedRecord.id);
						if (attachmentsData && attachmentsData.length > 0) {
							recordToStore = { ...recordToStore, deviation_attachments: normalizeRecord(attachmentsData) };
						}
					} catch (attachmentsError) {
						console.warn('Deviation attachments çekilemedi:', attachmentsError);
					}
				}
			}

			if (type === 'training_record' && normalizedRecord.id) {
				try {
					const { data: fullTraining, error: trainingFetchError } = await supabase
						.from('trainings')
						.select(`
							*,
							training_participants (
								id,
								status,
								score,
								personnel_id,
								personnel:personnel_id ( id, full_name, department, unit:cost_settings ( unit_name ) )
							)
						`)
						.eq('id', normalizedRecord.id)
						.maybeSingle();
					if (!trainingFetchError && fullTraining) {
						recordToStore = normalizeRecord(fullTraining);
					}
				} catch (trainingErr) {
					console.warn('Eğitim tam kayıt çekilemedi, gönderilen veri kullanılacak:', trainingErr);
				}
			}

			if (type === 'training_exam_results' && normalizedRecord.id) {
				try {
					const { data: fullTraining, error: trainingFetchError } = await supabase
						.from('trainings')
						.select(`
							*,
							training_exams (*),
							training_participants (
								id,
								status,
								score,
								completed_at,
								personnel_id,
								personnel:personnel_id ( id, full_name, department, unit:cost_settings ( unit_name ) )
							)
						`)
						.eq('id', normalizedRecord.id)
						.maybeSingle();
					if (!trainingFetchError && fullTraining) {
						recordToStore = normalizeRecord(fullTraining);
					}
				} catch (trainingErr) {
					console.warn('Sınav sonuçları eğitim kaydı çekilemedi, gönderilen veri kullanılacak:', trainingErr);
				}
			}

			// Veriyi localStorage'a kaydet (zaten normalize edilmiş)
			const normalizedRecordToStore = recordToStore;
			localStorage.setItem(storageKey, JSON.stringify(normalizedRecordToStore));

			// Sadece storage key'ini URL'de gönder
			const params = new URLSearchParams({
				storageKey: storageKey,
				autoprint: 'true',
			});

			const reportUrl = `/print/report/${type}/${reportId}?${params.toString()}`;
			console.log('📄 Rapor URL:', reportUrl);
			console.log('📄 Storage Key:', storageKey);
			console.log('📄 Record Data (normalized):', normalizedRecordToStore);

			navigateReportWindow(reportUrl);

			// PDF yüklendikten sonra localStorage'ı temizle (30 saniye sonra-yavaş bağlantılarda da çalışsın)
			setTimeout(() => {
				localStorage.removeItem(storageKey);
			}, 30000);
		} catch (error) {
			console.error("Error storing report data:", error);

			// Fallback: Liste tipleri için hata, diğerleri için database fetch
			const isListTypeFallback = ['quarantine_list', 'deviation_list', 'incoming_inspection_list', 'document_list', 'nonconformity_record_list', 'fixture_list', 'leak_test_list', 'process_inspection_list', 'kpi_list', 'fmea_project_list'].includes(type);
			if (isListTypeFallback) {
				alert(`Rapor oluşturulurken hata: ${error.message}`);
				try {
					reportWindow.close();
				} catch {
					/* noop */
				}
				return;
			}
			// Fallback: database fetch
			navigateReportWindow(`/print/report/${type}/${reportId}?autoprint=true`);
		}
	} else {
		// Normal database fetch
		navigateReportWindow(`/print/report/${type}/${reportId}?autoprint=true`);
	}
};

const getReportTitle = (record, type) => {
	if (!record) return 'Rapor';
	switch (type) {
		case 'supplier_audit': {
			const _saSupplierName = record.supplier?.name || 'Bilinmiyor';
			const _saAuditDate = record.audit_date ? new Date(record.audit_date).toLocaleDateString('tr-TR') : '';
			const _saAuditNo = record.id ? String(record.id).slice(0, 8).toUpperCase() : '';
			return `Tedarikçi Denetim Raporu-${_saSupplierName}${_saAuditDate ? `-${_saAuditDate}` : ''}${_saAuditNo ? `-${_saAuditNo}` : ''}`;
		}
		case 'internal_audit':
			return `İç Tetkik Raporu-${record.report_number || 'Bilinmiyor'}`;
		case 'sheet_metal_entry':
			return `Sac Metal Giriş Raporu-${record.delivery_note_number || 'Bilinmiyor'}`;
		case 'incoming_inspection':
			return `Girdi Kontrol Raporu-${record.record_no || 'Bilinmiyor'}`;
		case 'process_inspection':
			return `Proses Muayene Raporu-${record.record_no || 'Bilinmiyor'}`;
		case 'deviation':
			return `Sapma Talep Raporu-${record.request_no || 'Bilinmiyor'}`;
		case 'deviation_list':
			return record.title || 'Sapma Yönetimi Liste Raporu';
		case 'nonconformity': {
			const typeStr =
				record.type === 'MDI' ? 'MDI' :
				record.type === '8D' ? '8D' :
				record.type === 'DF' ? 'DF' :
				safeReportTitleSegment(record.type, 12) || 'DF';
			const docNo = safeReportTitleSegment(record.nc_number || record.mdi_no || '', 48);
			const fallbackId = record.id ? `Kayıt-${String(record.id).slice(0, 36)}` : '';
			const numberPart = docNo || fallbackId || 'NumaraYok';
			const titlePart = safeReportTitleSegment(record.title || '', 100);
			const deptPart = safeReportTitleSegment(record.department || '', 60);

			if (record.is_supplier_nc || record.department === 'Tedarikçi' || record.supplier_id) {
				const supplierName =
					record.supplier_name ||
					record.supplier?.name ||
					(record.suppliers && record.suppliers.name) ||
					'Tedarikçi';
				const sup = safeReportTitleSegment(supplierName, 60);
				if (titlePart) return `${typeStr} ${numberPart} - ${sup} - ${titlePart}`;
				return `${typeStr} ${numberPart} - ${sup}`;
			}
			const segments = [typeStr, numberPart, deptPart, titlePart].filter(Boolean);
			return segments.join(' - ');
		}
		case 'nonconformity_record':
			return `Uygunsuzluk Yönetimi Raporu-${record.record_number || 'Bilinmiyor'}`;
		case 'nonconformity_record_list':
			return record.title || 'Uygunsuzluk Yönetimi Liste Raporu';
		case 'kaizen':
			return `Kaizen Raporu-${record.kaizen_no || 'Bilinmiyor'}`;
		case 'quarantine': {
			const qParts = [record.part_code, record.part_name, record.status].filter(Boolean);
			return qParts.length > 0 ? `Karantina Raporu-${qParts.join('-')}` : `Karantina Raporu-${record.lot_no || record.id || 'Rapor'}`;
		}
		case 'quarantine_decision_certificate': {
			const d = record.quarantine_certificate_decision || 'Karar';
			const seg = safeReportTitleSegment(d, 20);
			return `Karantina Karar Tutanağı-${record.part_code || record.lot_no || 'Kayıt'}-${seg}`;
		}
		case 'quarantine_list':
			return 'Genel Karantina Raporu';
		case 'wps':
			return `Kaynak Prosedür Şartnamesi (WPS)-${record.wps_no || 'Bilinmiyor'}`;
		case 'equipment':
			return `Ekipman Raporu-${record.serial_number || 'Bilinmiyor'}`;
		case 'equipment_scrap_certificate':
			return `Hurda Tutanağı-${record.serial_number || record.name || 'Bilinmiyor'}`;
		case 'equipment_list':
			return 'Ekipman ve Kalibrasyon Listesi Raporu';
		case 'certificate':
			return `Başarı Sertifikası-${record.personnelName || ''}`;
		case 'exam_paper':
			return `Sınav Kağıdı-${record.title || ''}`;
		case 'training_record':
			return record.title
				? `Eğitim Kayıt Raporu — ${record.title}`
				: 'Eğitim Kayıt ve Katılım Raporu';
		case 'training_exam_results': {
			const code = safeReportTitleSegment(record.training_code || '', 48);
			const title = safeReportTitleSegment(record.title || 'Eğitim', 120);
			const sd = formatDateOnlyLocal(record.start_date, 'dd.MM.yyyy') || '';
			const ed = formatDateOnlyLocal(record.end_date, 'dd.MM.yyyy') || '';
			const period = sd && ed ? `${sd} – ${ed}` : sd || ed || '';
			const parts = ['Sınav Sonuçları', code || title, period].filter(Boolean);
			return parts.join(' — ');
		}
		case 'incoming_control_plans':
			return `Gelen Kontrol Planı-${record.part_code || 'Bilinmiyor'}`;
		case 'inkr_management':
			return `INKR Raporu-${record.inkr_number || 'Bilinmiyor'}`;
		case 'stock_risk_controls':
			return `Stok Risk Kontrol Raporu-${record.control_number || 'Bilinmiyor'}`;
		case 'polyvalence_matrix':
			return 'Polivalans Matrisi Raporu';
		case 'dynamic_balance':
			return `Dinamik Balans Raporu-${record.serial_number || 'Bilinmiyor'}`;
		case 'supplier_list':
			return record.title || 'Tedarikçi Listesi Raporu';
		case 'supplier_dashboard':
			return record.title || 'Tedarikçi Kalite Genel Bakış Raporu';
		case 'quality_cost_list':
			return record.unit ? `${record.unit} Birimi-Kalite Maliyetleri Raporu` : 'Kalite Maliyetleri Raporu';
		case 'quality_cost_executive_summary':
			return record.unit ? `${record.unit} Birimi-Kalite Maliyeti Yönetici Özeti Raporu` : 'Kalite Maliyeti Yönetici Özeti Raporu';
		case 'quality_cost_detail':
			return 'Kalite Maliyeti Detay Raporu';
		case 'incoming_quality_executive_summary':
			return 'Girdi Kalite Kontrol Yönetici Özeti Raporu';
		case 'produced_vehicles_executive_summary':
			return 'Üretilen Araçlar Yönetici Özeti Raporu';
		case 'supplier_quality_executive_summary':
			return 'Tedarikçi Kalite Yönetimi Yönetici Özeti Raporu';
		case 'document_list':
			return record.categoryName
				? `${record.categoryName} Listesi`
				: 'Doküman Listesi Raporu';
		case 'kpi_list':
			return record.title || 'KPI Performans Raporu';
		case 'leak_test_list':
			return record.title || 'Sızdırmazlık Test Listesi Raporu';
		case 'process_inspection_list':
			return record.title || 'Proses Muayene Listesi Raporu';
		case 'fixture_list':
			return record.title || 'Fikstür Liste Raporu';
		case 'fmea':
			return `FMEA Raporu-${record.fmea_number || record.fmea_name || 'Kayıt'}`;
		case 'fmea_project_list':
			return record.title || 'FMEA Proje Listesi Raporu';
		case 'process_control_plans':
			return `Kontrol Planı-${record.part_code || ''}${record.part_name ? `-${record.part_name}` : ''}` || 'Kontrol Planı';
		default:
			// Eğer record'da title varsa onu kullan, yoksa genel başlık
			return record?.title ? `${record.title} Raporu` : 'Detaylı Rapor';
	}
};

const getFormNumber = (type) => {
	const formNumbers = {
		nonconformity: 'FR-KAL-021',
		kaizen: 'FR-KAL-022',
		incoming_inspection: 'FR-KAL-023',
		deviation: 'FR-KAL-024',
		deviation_list: 'FR-KAL-024-A',
		quarantine: 'FR-KAL-025',
		quarantine_decision_certificate: 'FR-KAL-025-KT',
		quarantine_list: 'FR-KAL-025-A',
		supplier_audit: 'FR-KAL-026',
		sheet_metal_entry: 'FR-KAL-027',
		wps: 'FR-KAL-028',
		internal_audit: 'FR-KAL-029',
		equipment: 'FR-KAL-030',
		equipment_scrap_certificate: 'FR-KAL-030-H',
		certificate: 'FR-EGT-001',
		exam_paper: 'FR-EGT-002',
		polyvalence_matrix: 'FR-EGT-003',
		training_record: 'FR-EGT-004',
		training_exam_results: 'FR-EGT-005',
		dynamic_balance: 'FR-KAL-031',
		nonconformity_record: 'FR-KAL-032',
		nonconformity_record_list: 'FR-KAL-032-A',
		kpi_list: 'FR-KPI-001',
		leak_test_list: 'FR-KAL-033',
		process_inspection_list: 'FR-KAL-034',
	};
	return formNumbers[type] || 'FR-GEN-000';
};

const generateCertificateReportHtml = (record) => {
	const formatDate = (dateStr) => dateStr ? format(new Date(dateStr), 'dd MMMM yyyy', { locale: tr }) : '-';
	const participantName = record?.personnelName || 'VERİ YOK';
	const certificateType = record?.certificateType || 'success'; // 'success' veya 'participation'

	// Sertifika tipine göre başlık ve metinler
	const certificateTitle = certificateType === 'success' ? 'BAŞARI SERTİFİKASI' : 'KATILIM SERTİFİKASI';
	const subtitleText = certificateType === 'success'
		? 'Bu sertifika, aşağıdaki eğitimi başarıyla tamamlayan'
		: 'Bu sertifika, aşağıdaki eğitime katılan';
	const descriptionText = certificateType === 'success'
		? `adlı katılımcıya, "${record?.trainingTitle || 'Eğitim Adı'}" eğitimini başarıyla tamamladığı için verilmiştir.`
		: `adlı katılımcıya, "${record?.trainingTitle || 'Eğitim Adı'}" eğitimine katıldığı için verilmiştir.`;

	// Logoları base64 olarak al - public klasöründeki logo.png dosyasını kullan
	const localKademeLogo = getLogoUrl('logo.png');
	const kademeLogoBase64 = logoCache[localKademeLogo] || localKademeLogo;
	const albayrakLogoBase64 = kademeLogoBase64; // Aynı logoyu kullan

	return `
		<div class="certificate-container">
			<div class="certificate-content">
				<div class="bg-shape top-right"></div>
				<div class="bg-shape bottom-left"></div>
				
				<div class="logo-header">
					<img class="header-logo" alt="Kademe Logosu" src="${kademeLogoBase64}" />
					<img class="header-logo" alt="Albayrak Logosu" src="${albayrakLogoBase64}" />
				</div>

		<div class="header-section">
			<p class="company-name">KADEME AKADEMİ</p>
			<h1 class="main-title">${certificateTitle}</h1>
			<p class="subtitle">${subtitleText}</p>
		</div>

		<p class="participant-name">${participantName}</p>
		
		<p class="training-title">${descriptionText}</p>

		<div class="details-section">
			<div class="detail-item">
				<strong>Eğitim Tarihi</strong>
				<span>${formatDate(record?.completedAt)}</span>
			</div>
			<div class="detail-item">
				 <strong>Sertifika No</strong>
				 <span>${record?.id?.substring(0, 8).toUpperCase() || 'N/A'}</span>
			</div>
		</div>

		<div class="signature-area">
			<div class="signature-block">
				<p class="name">${record?.trainingInstructor || 'Eğitmen Adı'}</p>
				<div class="signature-line"></div>
				<p class="title">Eğitmen</p>
			</div>
			<div class="signature-block">
				<p class="name">Atakan BATTAL</p>
				<div class="signature-line"></div>
				<p class="title">Kalite Güvence Yöneticisi</p>
			</div>
			<div class="signature-block">
				<p class="name">Kenan ÇELİK</p>
				<div class="signature-line"></div>
				<p class="title">Genel Müdür</p>
			</div>
		</div>
	</div>
</div>
`;
};

const generateExamPaperHtml = (record) => {
	const exam = record;
	const questions = exam.training_exam_questions || [];

	const questionsHtml = questions.map((q, index) => {
		const optionsHtml = q.options?.map((opt, i) => `
			<div class="exam-option">
				<div class="exam-option-letter">${String.fromCharCode(65 + i)}</div>
				<div class="exam-option-text">${opt.text}</div>
			</div>
		`).join('') || '';

		return `
			<div class="exam-question-card">
				<div class="exam-question-header">
					<span class="exam-question-number">Soru ${index + 1}</span>
					<span class="exam-question-points">${q.points || 0} Puan</span>
				</div>
				<p class="exam-question-text">${q.question_text}</p>
				<div class="exam-options-grid">
					${optionsHtml}
				</div>
			</div>
		`;
	}).join('');

	// Logo base64 - public klasöründeki logo.png dosyasını kullan
	const localLogoUrl = getLogoUrl('logo.png');
	const mainLogoBase64 = logoCache[localLogoUrl] || localLogoUrl;

	return `
		<div class="exam-header">
			<div class="company-logo-exam">
				<img src="${mainLogoBase64}" alt="Kademe Logo">
			</div>
			<div class="exam-title-section">
				<h1>${exam.title || 'Sınav Değerlendirme Formu'}</h1>
				<p>${exam.trainings?.title || 'Genel Eğitim'}</p>
			</div>
			 <div class="exam-meta-grid">
				<div><strong>Doküman No:</strong> ${getFormNumber('exam_paper')}</div>
				<div><strong>Yayın Tarihi:</strong> ${format(new Date(), 'dd.MM.yyyy')}</div>
				<div><strong>Revizyon No:</strong> 00</div>
			 </div>
		</div>

		<div class="exam-participant-info">
			<div class="exam-info-field">
				<label>Ad Soyad</label>
				<span></span>
			</div>
			<div class="exam-info-field">
				<label>Tarih</label>
				<span></span>
			</div>
			<div class="exam-info-field">
				<label>Toplam Puan</label>
				<span></span>
			</div>
			 <div class="exam-info-field">
				<label>Geçme Notu</label>
				<span class="static-value">${exam.passing_score || '-'}</span>
			</div>
		</div>

		<div class="exam-questions-container">
			${questionsHtml}
		</div>
	`;
};

const generateTrainingRecordReportHtml = (record) => {
	const escapeHtml = (v) => {
		if (v == null || v === '') return '';
		return String(v)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	};
	/* Birleşik nokta (i + U+0307) gibi kayıtları yazdırmada düzelt */
	const normalizeTrDisplay = (v) => {
		if (v == null || v === '') return '';
		return String(v)
			.normalize('NFC')
			.replace(/\u0069\u0307/g, '\u0069')
			.replace(/\u0049\u0307/g, '\u0130')
			.replace(/\u0130\u0307/g, '\u0130');
	};
	const esc = (v) => escapeHtml(normalizeTrDisplay(v));
	const nl2br = (s) => {
		if (s == null || String(s).trim() === '') return '—';
		const n = normalizeTrDisplay(s);
		return n === '' ? '—' : escapeHtml(n).replace(/\n/g, '<br>');
	};
	const fmtDateLong = (d) => formatDateOnlyLocal(d, 'dd MMMM yyyy') || '—';

	const localLogoUrl = getLogoUrl('logo.png');
	const mainLogoBase64 = logoCache[localLogoUrl] || localLogoUrl;

	const participants = [...(record.training_participants || [])].sort((a, b) =>
		normalizeTrDisplay(a.personnel?.full_name || '').localeCompare(normalizeTrDisplay(b.personnel?.full_name || ''), 'tr')
	);

	const orgCell = (pr) => {
		if (!pr) return '—';
		const parts = [...new Set([pr.department, pr.management_department || pr.unit?.unit_name].filter(Boolean))];
		return esc(parts.length ? parts.join(' · ') : '—');
	};

	const participantsRows = participants.length
		? participants.map((p, index) => `
			<tr>
				<td>${index + 1}</td>
				<td>${esc(p.personnel?.full_name) || '—'}</td>
				<td>${orgCell(p.personnel)}</td>
				<td>${esc(p.status) || '—'}</td>
				<td class="training-sign-cell"></td>
			</tr>
		`).join('')
		: `<tr><td colspan="5" style="text-align:center;color:#6b7280;padding:12px;">Kayıtlı katılımcı yok.</td></tr>`;

	const instructorName = record.instructor || '—';
	const formNo = getFormNumber('training_record');

	return `
		<div class="report-header training-record-report-header">
			<div class="report-logo">
				<img src="${mainLogoBase64}" alt="Kademe Logo">
			</div>
			<div class="company-title training-record-company-block">
				<h1>KADEME A.Ş.</h1>
				<p class="company-subline">Kalite Yönetim Sistemi</p>
				<p class="training-record-doc-title">Eğitim kayıt ve katılım raporu</p>
			</div>
			<div class="training-record-header-spec">
				<div class="training-record-spec-title">Form bilgileri</div>
				<div class="training-record-spec-row"><span class="spec-k">Doküman no</span><span class="spec-v">${formNo}</span></div>
				<div class="training-record-spec-row"><span class="spec-k">Eğitim kodu</span><span class="spec-v">${esc(record.training_code) || '—'}</span></div>
				<div class="training-record-spec-row"><span class="spec-k">Revizyon</span><span class="spec-v">00</span></div>
				<div class="training-record-spec-row"><span class="spec-k">Sayfa</span><span class="spec-v">1 / 1</span></div>
			</div>
		</div>

		<div class="section">
			<h2 class="section-title blue">1. EĞİTİM BİLGİLERİ</h2>
			<table class="info-table">
				<tbody>
					<tr><td>Eğitim başlığı</td><td>${esc(record.title) || '—'}</td></tr>
					<tr><td>Eğitim kodu</td><td>${esc(record.training_code) || '—'}</td></tr>
					<tr><td>Kategori</td><td>${esc(record.category) || '—'}</td></tr>
					<tr><td>Eğitim türü</td><td>${esc(record.training_type) || '—'}</td></tr>
					<tr><td>Başlangıç</td><td>${fmtDateLong(record.start_date)}</td></tr>
					<tr><td>Bitiş</td><td>${fmtDateLong(record.end_date)}</td></tr>
					<tr><td>Süre (saat)</td><td>${record.duration_hours != null ? esc(String(record.duration_hours)) : '—'}</td></tr>
					<tr><td>Konum / ortam</td><td>${esc(record.location) || '—'}</td></tr>
					<tr><td>Eğitmen</td><td>${esc(instructorName)}</td></tr>
					<tr><td>Kontenjan</td><td>${record.capacity != null ? esc(String(record.capacity)) : '—'}</td></tr>
					<tr><td>Hedef kitle</td><td class="training-value-multiline">${nl2br(record.target_audience)}</td></tr>
					<tr><td>Amaçlar</td><td class="training-value-multiline">${nl2br(record.objectives)}</td></tr>
					<tr><td>Ön koşullar</td><td class="training-value-multiline">${nl2br(record.prerequisites)}</td></tr>
					<tr><td>Açıklama</td><td class="training-value-multiline">${nl2br(record.description)}</td></tr>
				</tbody>
			</table>
		</div>

		<div class="section">
			<h2 class="section-title blue">2. KATILIMCI LİSTESİ</h2>
			<table class="training-participants-table">
				<thead>
					<tr>
						<th style="width:36px;">#</th>
						<th>Ad soyad</th>
						<th style="width:24%;">Alt birim / birim</th>
						<th style="width:16%;">Durum</th>
						<th style="width:22%;">İmza</th>
					</tr>
				</thead>
				<tbody>
					${participantsRows}
				</tbody>
			</table>
		</div>

		<div class="section">
			<h2 class="section-title blue">3. EĞİTMEN VE ONAY</h2>
			<div class="training-footer-signatures">
				<div class="training-sign-block">
					<div class="role">Eğitmen</div>
					<div class="named">${esc(instructorName)}</div>
					<div class="line"></div>
					<div class="sub">Ad Soyad ve İmza</div>
				</div>
				<div class="training-sign-block">
					<div class="role">Eğitim sorumlusu</div>
					<div class="named">&nbsp;</div>
					<div class="line"></div>
					<div class="sub">Ad Soyad ve İmza</div>
				</div>
			</div>
		</div>
	`;
};

const generateTrainingExamResultsReportHtml = (record) => {
	const escapeHtml = (v) => {
		if (v == null || v === '') return '';
		return String(v)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	};
	const normalizeTrDisplay = (v) => {
		if (v == null || v === '') return '';
		return String(v)
			.normalize('NFC')
			.replace(/\u0069\u0307/g, '\u0069')
			.replace(/\u0049\u0307/g, '\u0130')
			.replace(/\u0130\u0307/g, '\u0130');
	};
	const esc = (v) => escapeHtml(normalizeTrDisplay(v));
	const fmtDateLong = (d) => formatDateOnlyLocal(d, 'dd MMMM yyyy') || '—';
	const fmtDateShort = (d) => formatDateOnlyLocal(d, 'dd.MM.yyyy') || '—';

	const localLogoUrl = getLogoUrl('logo.png');
	const mainLogoBase64 = logoCache[localLogoUrl] || localLogoUrl;

	const exams = record.training_exams || [];
	const exam = exams[0];
	const participants = [...(record.training_participants || [])].sort((a, b) =>
		normalizeTrDisplay(a.personnel?.full_name || '').localeCompare(normalizeTrDisplay(b.personnel?.full_name || ''), 'tr')
	);

	const participantsRows = participants.length
		? participants.map((p, index) => {
			let resultCell = esc(p.status) || '—';
			if (p.status === 'Tamamlandı' && exam && p.score !== null && p.score !== undefined) {
				resultCell = p.score >= exam.passing_score
					? '<span style="color:#059669;font-weight:700;">Geçti</span>'
					: '<span style="color:#dc2626;font-weight:700;">Kaldı</span>';
			}
			return `
			<tr>
				<td>${index + 1}</td>
				<td>${esc(p.personnel?.full_name) || '—'}</td>
				<td>${esc(exam?.title) || '—'}</td>
				<td>${p.score !== null && p.score !== undefined ? esc(String(p.score)) : '—'}</td>
				<td>${exam?.passing_score != null ? esc(String(exam.passing_score)) : '—'}</td>
				<td>${resultCell}</td>
				<td>${p.completed_at ? fmtDateShort(p.completed_at) : '—'}</td>
			</tr>`;
		}).join('')
		: '<tr><td colspan="7" style="text-align:center;color:#6b7280;padding:12px;">Kayıtlı katılımcı yok.</td></tr>';

	const formNo = getFormNumber('training_exam_results');

	return `
		<div class="report-header training-record-report-header">
			<div class="report-logo">
				<img src="${mainLogoBase64}" alt="Kademe Logo">
			</div>
			<div class="company-title training-record-company-block">
				<h1>KADEME A.Ş.</h1>
				<p class="company-subline">Kalite Yönetim Sistemi</p>
				<p class="training-record-doc-title">Sınav sonuçları raporu</p>
			</div>
			<div class="training-record-header-spec">
				<div class="training-record-spec-title">Form bilgileri</div>
				<div class="training-record-spec-row"><span class="spec-k">Doküman no</span><span class="spec-v">${formNo}</span></div>
				<div class="training-record-spec-row"><span class="spec-k">Eğitim kodu</span><span class="spec-v">${esc(record.training_code) || '—'}</span></div>
				<div class="training-record-spec-row"><span class="spec-k">Revizyon</span><span class="spec-v">00</span></div>
				<div class="training-record-spec-row"><span class="spec-k">Sayfa</span><span class="spec-v">1 / 1</span></div>
			</div>
		</div>

		<div class="section">
			<h2 class="section-title blue">1. EĞİTİM TANIMI (AYIRT EDİCİ BİLGİLER)</h2>
			<table class="info-table">
				<tbody>
					<tr><td>Eğitim başlığı</td><td>${esc(record.title) || '—'}</td></tr>
					<tr><td>Eğitim kodu</td><td>${esc(record.training_code) || '—'}</td></tr>
					<tr><td>Eğitim başlangıç tarihi</td><td>${fmtDateLong(record.start_date)}</td></tr>
					<tr><td>Eğitim tamamlanma tarihi</td><td>${fmtDateLong(record.end_date)}</td></tr>
					<tr><td>Kategori</td><td>${esc(record.category) || '—'}</td></tr>
					<tr><td>Eğitmen</td><td>${esc(record.instructor) || '—'}</td></tr>
				</tbody>
			</table>
		</div>

		<div class="section">
			<h2 class="section-title blue">2. SINAV SONUÇLARI</h2>
			<table class="training-participants-table training-exam-results-table">
				<thead>
					<tr>
						<th style="width:36px;">#</th>
						<th>Katılımcı</th>
						<th style="width:22%;">Sınav</th>
						<th style="width:10%;">Puan</th>
						<th style="width:10%;">Geçme notu</th>
						<th style="width:12%;">Sonuç</th>
						<th style="width:14%;">Tamamlanma</th>
					</tr>
				</thead>
				<tbody>
					${participantsRows}
				</tbody>
			</table>
		</div>
	`;
};

const trainingRecordReportStyles = `
	.report-header.training-record-report-header {
		grid-template-columns: auto minmax(0, 1fr) minmax(148px, 24%);
		gap: 10px 14px;
		align-items: center;
		padding: 8px 12px !important;
		margin-bottom: 10px !important;
	}
	.training-record-report-header .report-logo {
		padding: 0;
	}
	.training-record-report-header .report-logo img {
		height: 40px !important;
		max-height: 40px;
		width: auto;
	}
	.training-record-company-block {
		text-align: center;
		padding: 2px 8px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		min-width: 0;
		border-left: 1px solid #e5e7eb;
		border-right: 1px solid #e5e7eb;
	}
	.training-record-company-block h1 {
		margin: 0 0 1px 0 !important;
		font-size: 15px !important;
		line-height: 1.2 !important;
		letter-spacing: 0.02em;
		color: #0f172a;
	}
	.training-record-company-block .company-subline {
		margin: 0 0 3px 0 !important;
		font-size: 9px !important;
		line-height: 1.2 !important;
		font-weight: 600;
		color: #64748b;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.training-record-doc-title {
		margin: 0 !important;
		font-size: 10px !important;
		font-weight: 700;
		color: #1e40af;
		line-height: 1.25 !important;
		text-transform: none;
		letter-spacing: 0.02em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.training-record-header-spec {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 4px;
		padding: 6px 8px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0;
		box-sizing: border-box;
		align-self: center;
	}
	.training-record-spec-title {
		font-size: 7px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: #475569;
		margin: 0 0 4px 0;
		padding-bottom: 3px;
		border-bottom: 1px solid #1e40af;
		line-height: 1.2;
	}
	.training-record-spec-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
		padding: 2px 0;
		border-bottom: 1px solid #e5e7eb;
		font-size: 8px;
		line-height: 1.25;
	}
	.training-record-spec-row:last-of-type {
		border-bottom: none;
		padding-bottom: 0;
	}
	.training-record-header-spec .spec-k {
		color: #64748b;
		font-weight: 600;
		flex-shrink: 0;
	}
	.training-record-header-spec .spec-v {
		color: #0f172a;
		font-weight: 700;
		text-align: right;
		word-break: break-word;
		max-width: 58%;
	}
	@media print {
		.report-header.training-record-report-header {
			padding: 6px 10px !important;
			margin-bottom: 8px !important;
			gap: 8px 12px;
		}
		.training-record-header-spec {
			print-color-adjust: exact;
			-webkit-print-color-adjust: exact;
		}
	}
	.info-table td.training-value-multiline {
		white-space: pre-wrap;
		line-height: 1.5;
		vertical-align: top;
	}
	.training-participants-table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 6px; }
	.training-exam-results-table { font-size: 9px; }
	.training-exam-results-table th:nth-child(4),
	.training-exam-results-table th:nth-child(5),
	.training-exam-results-table td:nth-child(4),
	.training-exam-results-table td:nth-child(5) { text-align: center; }
	.training-participants-table thead { display: table-header-group; }
	.training-participants-table thead th { background: #1e40af; color: #fff; padding: 8px; text-align: left; font-weight: 600; }
	.training-participants-table td { border: 1px solid #e5e7eb; padding: 6px 8px; vertical-align: middle; }
	.training-participants-table tbody tr { page-break-inside: avoid; break-inside: avoid; }
	.training-sign-cell { min-height: 44px; background: #fafafa; border-bottom: 2px solid #94a3b8 !important; vertical-align: bottom !important; }
	.training-footer-signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 24px; page-break-inside: avoid; break-inside: avoid; }
	.training-sign-block { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; text-align: center; background: #fff; }
	.training-sign-block .role { font-size: 10px; font-weight: 700; color: #1f2937; margin-bottom: 8px; }
	.training-sign-block .named { font-size: 10px; color: #4b5563; min-height: 20px; }
	.training-sign-block .line { border-bottom: 2px solid #374151; min-height: 52px; margin: 10px 8px 6px; }
	.training-sign-block .sub { font-size: 8px; color: #6b7280; line-height: 1.35; }
`;


const generateDynamicBalanceReportHtml = (record) => {
	const formatDate = (dateStr) => dateStr ? format(new Date(dateStr), 'dd.MM.yyyy', { locale: tr }) : '-';
	const formatDateTime = (dateStr) => dateStr ? format(new Date(dateStr), 'dd.MM.yyyy HH:mm', { locale: tr }) : '-';

	const getResultBadge = (result) => {
		if (result === 'PASS') {
			return '<span style="background: #10b981; color: white; padding: 6px 16px; border-radius: 6px; font-weight: 700; font-size: 13px; display: inline-block;">✓ PASS</span>';
		} else if (result === 'FAIL') {
			return '<span style="background: #ef4444; color: white; padding: 6px 16px; border-radius: 6px; font-weight: 700; font-size: 13px; display: inline-block;">✗ FAIL</span>';
		}
		return '<span style="background: #6b7280; color: white; padding: 6px 16px; border-radius: 6px; font-size: 13px; display: inline-block;">-</span>';
	};

	// Logo base64 - public klasöründeki logo.png dosyasını kullan
	const localLogoUrl = getLogoUrl('logo.png');
	const mainLogoBase64 = logoCache[localLogoUrl] || localLogoUrl;

	return `
		<div class="report-header">
			<div class="report-logo">
				<img src="${mainLogoBase64}" alt="Kademe Logo">
			</div>
			<div class="company-title">
				<h1>KADEME A.Ş.</h1>
				<p>Kalite Yönetim Sistemi</p>
			</div>
			<div class="print-info">
				Rapor Tarihi: ${formatDateTime(new Date())}
			</div>
		</div>

		<div class="meta-box" style="display: flex; justify-content: space-between; align-items: center;">
			<div class="meta-item"><strong>Belge Türü / Document Type:</strong> Dinamik Balans Kalite Kontrol Raporu / Dynamic Balance Quality Control Report</div>
			<div class="meta-item" style="margin-left: auto; text-align: right;"><strong>Standard:</strong> ISO 21940-11:2016</div>
		</div>

		<div class="section">
			<h2 class="section-title blue">1. TEMEL BİLGİLER / BASIC INFORMATION</h2>
			<table class="info-table">
				<tbody>
					<tr>
						<td style="width: 30%; font-weight: 600; background-color: #f8fafc;">Fan Seri Numarası / Serial Number:</td>
						<td style="width: 70%;">${record.serial_number || '-'}</td>
					</tr>
					${record.fan_products ? `
					<tr>
						<td style="font-weight: 600; background-color: #f8fafc;">Ürün Tanımı / Product Definition:</td>
						<td>${record.fan_products.product_code || '-'}-${record.fan_products.product_name || '-'}</td>
					</tr>
					` : ''}
					<tr>
						<td style="font-weight: 600; background-color: #f8fafc;">Test Tarihi / Test Date:</td>
						<td>${formatDate(record.test_date)}</td>
					</tr>
					<tr>
						<td style="font-weight: 600; background-color: #f8fafc;">Tedarikçi / Supplier:</td>
						<td>${record.supplier_name || '-'}</td>
					</tr>
					<tr>
						<td style="font-weight: 600; background-color: #f8fafc;">Test Operatörü / Test Operator:</td>
						<td>${record.test_operator || '-'}</td>
					</tr>
				</tbody>
			</table>
		</div>

		<div class="section">
			<h2 class="section-title blue">2. PARAMETRELER / PARAMETERS</h2>
			<table class="info-table">
				<tbody>
					<tr>
						<td style="width: 25%; font-weight: 600; background-color: #f8fafc;">Fan Ağırlığı / Fan Weight:</td>
						<td style="width: 25%;">${record.fan_weight_kg ? record.fan_weight_kg.toFixed(3) : '-'} kg</td>
						<td style="width: 25%; font-weight: 600; background-color: #f8fafc;">Çalışma Devri / Operating RPM:</td>
						<td style="width: 25%;">${record.operating_rpm || '-'} RPM</td>
					</tr>
					<tr>
						<td style="font-weight: 600; background-color: #f8fafc;">Kalite Sınıfı / Quality Grade:</td>
						<td><strong>${record.balancing_grade || '-'}</strong></td>
						<td style="font-weight: 600; background-color: #f8fafc;">Balans Yarıçapı / Correction Radius:</td>
						<td><strong>${record.correction_radius_mm ? record.correction_radius_mm.toFixed(1) : '-'} mm</strong></td>
					</tr>
					<tr>
						<td style="font-weight: 600; background-color: #f8fafc;">İzin Verilen Limit (Uper) / Allowed Limit:</td>
						<td colspan="3"><strong>${record.calculated_uper_per_plane ? record.calculated_uper_per_plane.toFixed(3) : '-'} gr</strong> (her düzlem için / per plane)</td>
					</tr>
				</tbody>
			</table>
		</div>

		<div class="section">
			<h2 class="section-title blue">3. İLK DURUM ÖLÇÜMLERİ / INITIAL MEASUREMENTS (Düzeltme Öncesi / Before Correction)</h2>
			<table class="info-table" style="margin-top: 0;">
				<thead>
					<tr style="background-color: #1e40af; color: white;">
						<th style="width: 25%; padding: 12px; text-align: left; font-weight: 700;">Düzlem / Plane</th>
						<th style="width: 25%; padding: 12px; text-align: center; font-weight: 700;">Ağırlık / Weight (gr)</th>
						<th style="width: 25%; padding: 12px; text-align: center; font-weight: 700;">Açı / Angle (°)</th>
						<th style="width: 25%; padding: 12px; text-align: center; font-weight: 700;">Açıklama / Description</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td style="padding: 12px; font-weight: 600; background-color: #f8fafc;">
							LINKS<br>
							<span style="font-size: 11px; color: #64748b; font-weight: 400;">Sol Düzlem / Left Plane / 1. Yatak</span>
						</td>
						<td style="padding: 12px; text-align: center;">${record.initial_left_weight_gr ? record.initial_left_weight_gr.toFixed(3) : '-'}</td>
						<td style="padding: 12px; text-align: center;">${record.initial_left_angle_deg ? record.initial_left_angle_deg.toFixed(2) : '-'}</td>
						<td style="padding: 12px; text-align: center; font-size: 11px; color: #64748b;">Initial / İlk Durum</td>
					</tr>
					<tr>
						<td style="padding: 12px; font-weight: 600; background-color: #f8fafc;">
							RECHTS<br>
							<span style="font-size: 11px; color: #64748b; font-weight: 400;">Sağ Düzlem / Right Plane / 2. Yatak</span>
						</td>
						<td style="padding: 12px; text-align: center;">${record.initial_right_weight_gr ? record.initial_right_weight_gr.toFixed(3) : '-'}</td>
						<td style="padding: 12px; text-align: center;">${record.initial_right_angle_deg ? record.initial_right_angle_deg.toFixed(2) : '-'}</td>
						<td style="padding: 12px; text-align: center; font-size: 11px; color: #64748b;">Initial / İlk Durum</td>
					</tr>
				</tbody>
			</table>
		</div>

		<div class="section">
			<h2 class="section-title blue">4. KALAN DURUM ÖLÇÜMLERİ / RESIDUAL MEASUREMENTS (Düzeltme Sonrası / After Correction)</h2>
			<table class="info-table" style="margin-top: 0;">
				<thead>
					<tr style="background-color: #1e40af; color: white;">
						<th style="width: 25%; padding: 12px; text-align: left; font-weight: 700;">Düzlem / Plane</th>
						<th style="width: 20%; padding: 12px; text-align: center; font-weight: 700;">Kalan Ağırlık / Residual Weight (gr)</th>
						<th style="width: 15%; padding: 12px; text-align: center; font-weight: 700;">Açı / Angle (°)</th>
						<th style="width: 20%; padding: 12px; text-align: center; font-weight: 700;">Limit / Limit (gr)</th>
						<th style="width: 20%; padding: 12px; text-align: center; font-weight: 700;">Sonuç / Result</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td style="padding: 12px; font-weight: 600; background-color: #f8fafc;">
							LINKS<br>
							<span style="font-size: 11px; color: #64748b; font-weight: 400;">Sol Düzlem / Left Plane / 1. Yatak</span>
						</td>
						<td style="padding: 12px; text-align: center; font-weight: 600;">${record.residual_left_weight_gr ? record.residual_left_weight_gr.toFixed(3) : '-'}</td>
						<td style="padding: 12px; text-align: center;">${record.residual_left_angle_deg ? record.residual_left_angle_deg.toFixed(2) : '-'}</td>
						<td style="padding: 12px; text-align: center; color: #64748b;">${record.calculated_uper_per_plane ? record.calculated_uper_per_plane.toFixed(3) : '-'}</td>
						<td style="padding: 12px; text-align: center;">${record.left_plane_result ? getResultBadge(record.left_plane_result) : '-'}</td>
					</tr>
					<tr>
						<td style="padding: 12px; font-weight: 600; background-color: #f8fafc;">
							RECHTS<br>
							<span style="font-size: 11px; color: #64748b; font-weight: 400;">Sağ Düzlem / Right Plane / 2. Yatak</span>
						</td>
						<td style="padding: 12px; text-align: center; font-weight: 600;">${record.residual_right_weight_gr ? record.residual_right_weight_gr.toFixed(3) : '-'}</td>
						<td style="padding: 12px; text-align: center;">${record.residual_right_angle_deg ? record.residual_right_angle_deg.toFixed(2) : '-'}</td>
						<td style="padding: 12px; text-align: center; color: #64748b;">${record.calculated_uper_per_plane ? record.calculated_uper_per_plane.toFixed(3) : '-'}</td>
						<td style="padding: 12px; text-align: center;">${record.right_plane_result ? getResultBadge(record.right_plane_result) : '-'}</td>
					</tr>
				</tbody>
			</table>
		</div>

		<div class="section">
			<h2 class="section-title blue">5. GENEL SONUÇ / OVERALL RESULT</h2>
			<table class="info-table">
				<tbody>
					<tr>
						<td style="width: 30%; font-weight: 600; background-color: #f8fafc; padding: 16px;">Genel Sonuç / Overall Result:</td>
						<td style="width: 70%; padding: 16px; text-align: center;">
							${record.overall_result ? getResultBadge(record.overall_result) : '-'}
						</td>
					</tr>
				</tbody>
			</table>
		</div>

		${record.notes ? `
		<div class="section">
			<h2 class="section-title blue">6. NOTLAR / NOTES</h2>
			<div class="problem-description" style="padding: 16px; background-color: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
				${record.notes}
			</div>
		</div>
		` : ''}

		<div class="section signature-section">
			<h2 class="section-title dark">İMZA VE ONAY / SIGNATURE AND APPROVAL</h2>
			<div class="signature-area">
				<div class="signature-box">
					<p class="role">HAZIRLAYAN / PREPARED BY</p>
					<div class="signature-line"></div>
					<p class="name">Atakan BATTAL</p>
				</div>
			</div>
		</div>
	`;
};

const generateWPSReportHtml = (record) => {
	const formatDate = (dateStr) => dateStr ? format(new Date(dateStr), 'dd.MM.yyyy') : '-';
	const formatDateTime = (dateStr) => dateStr ? format(new Date(dateStr), 'dd.MM.yyyy HH:mm') : '-';

	const jointTypeMap = {
		'Butt': 'Alın (Butt)',
		'Fillet': 'Köşe (Fillet)'
	};

	// Kaynak tekniği açıklamaları
	const getTechniqueDescription = (technique) => {
		if (!technique) return '';
		const techUpper = technique.toUpperCase();
		if (techUpper.includes('STRINGER')) return 'Düz Dikiş';
		if (techUpper.includes('WEAVE')) return 'Salınım Dikiş';
		if (techUpper.includes('OSCILLAT')) return 'Salınım Dikiş';
		if (techUpper.includes('WIPING')) return 'Süpürme Tekniği';
		if (techUpper.includes('BACKSTEP')) return 'Geri Adım Tekniği';
		return '';
	};

	const passPlanHtml = record.pass_plan?.map(p => {
		const techniqueDesc = getTechniqueDescription(p.technique);
		return `
		<tr>
			<td>${p.pass || '-'}</td>
			<td>${p.technique || '-'}${techniqueDesc ? ` (${techniqueDesc})` : ''}</td>
			<td>${p.current_polarity || '-'}</td>
			<td>${p.min_current_a || ''}-${p.max_current_a || ''}</td>
			<td>${p.min_voltage_v || ''}-${p.max_voltage_v || ''}</td>
			<td>${p.travel_speed || '-'}</td>
			<td>${p.heat_input || '-'}</td>
		</tr>
	`;
	}).join('') || '<tr><td colspan="7" class="text-center">Paso planı detayı bulunamadı.</td></tr>';

	// Malzeme eşleştirmeleri (ISO standart → Türkçe eşdeğer)
	const getMaterialEquivalent = (materialName) => {
		if (!materialName) return '';
		const nameUpper = materialName.toUpperCase();
		// S355J2, S355JR, S355JO gibi → ST52
		if (nameUpper.includes('S355')) return 'ST52';
		// S235JR, S235JO gibi → ST37
		if (nameUpper.includes('S235')) return 'ST37';
		// S275JR, S275JO gibi → ST44
		if (nameUpper.includes('S275')) return 'ST44';
		// S420, S420ML gibi → ST52-3
		if (nameUpper.includes('S420')) return 'ST52-3';
		// S460, S460ML gibi → ST60
		if (nameUpper.includes('S460')) return 'ST60';
		return '';
	};

	// Proses kodu açıklamaları
	const processCodeMap = {
		'135': 'MAG',
		'131': 'MIG',
		'141': 'TIG',
		'111': 'MMA'
	};

	// Pozisyon kodu açıklamaları
	const positionMap = {
		'PA': 'Düz',
		'PB': 'Yatay Köşe',
		'PC': 'Yatay',
		'PD': 'Tavan Köşe',
		'PE': 'Tavan',
		'PF': 'Aşağıdan Yukarı',
		'PG': 'Yukarıdan Aşağı'
	};

	// Gaz açıklamaları ve karışım oranları (ISO 14175 standardına göre)
	const getGasDescription = (gasName) => {
		if (!gasName) return '';
		const nameUpper = gasName.toUpperCase();

		// I Grubu-İnert Gazlar
		// I1 (I-1): 100% Argon
		if (nameUpper.includes('I1') || nameUpper.includes('I-1')) {
			return 'Saf Argon (100% Ar)';
		}
		// I2 (I-2): 100% Helium
		if (nameUpper.includes('I2') || nameUpper.includes('I-2')) {
			return 'Saf Helyum (100% He)';
		}
		// I3 (I-3): Argon + Helium (He: 0.5-95%, Ar: balance)
		if (nameUpper.includes('I3') || nameUpper.includes('I-3')) {
			return 'Argon + Helyum Karışımı (He: 0.5-95%, Ar: balance)-Alüminyum için yüksek nüfuziyet';
		}

		// M1 Grubu-Düşük Oksitleyici Bileşenli Argon Bazlı Karışımlar
		// M1-1: CO2 0.5-5%, Ar: balance
		if (nameUpper.includes('M1-1')) {
			return 'Argon + CO₂ Karışımı (CO₂: 0.5-5%, Ar: balance)-Düşük sıçrantı';
		}
		// M1-2: CO2 0.5-5%, H2 0.5-5%, Ar: balance
		if (nameUpper.includes('M1-2')) {
			return 'Argon + CO₂ + H₂ Karışımı (CO₂: 0.5-5%, H₂: 0.5-5%, Ar: balance)';
		}
		// M1-3: O2 0.5-3%, Ar: balance (M12 burada)
		if (nameUpper.includes('M12') || nameUpper.includes('M1-3')) {
			return 'Argon + O₂ Karışımı (O₂: 0.5-3%, Ar: balance)-Paslanmaz çelik için düşük oksitleyici';
		}
		// M1-4: CO2 0.5-5%, O2 0.5-3%, Ar: balance
		if (nameUpper.includes('M1-4')) {
			return 'Argon + CO₂ + O₂ Karışımı (CO₂: 0.5-5%, O₂: 0.5-3%, Ar: balance)';
		}

		// M2 Grubu-Orta Oksitleyici Bileşenli Argon Bazlı Karışımlar
		// M2-0: CO2 5-15%, Ar: balance
		if (nameUpper.includes('M2-0')) {
			return 'Argon + CO₂ Karışımı (CO₂: 5-15%, Ar: balance)';
		}
		// M2-1: CO2 15-25%, Ar: balance (M21 burada)
		if (nameUpper.includes('M21') || nameUpper.includes('M2-1')) {
			return 'Argon + CO₂ Karışımı (CO₂: 15-25%, Ar: balance)-Karbon çelik için standart';
		}
		// M2-2: O2 3-10%, Ar: balance
		if (nameUpper.includes('M2-2')) {
			return 'Argon + O₂ Karışımı (O₂: 3-10%, Ar: balance)';
		}
		// M2-3: CO2 0.5-5%, O2 3-10%, Ar: balance
		if (nameUpper.includes('M2-3')) {
			return 'Argon + CO₂ + O₂ Karışımı (CO₂: 0.5-5%, O₂: 3-10%, Ar: balance)';
		}
		// M2-4: CO2 5-15%, O2 0.5-3%, Ar: balance
		if (nameUpper.includes('M2-4')) {
			return 'Argon + CO₂ + O₂ Karışımı (CO₂: 5-15%, O₂: 0.5-3%, Ar: balance)';
		}
		// M2-5: CO2 5-15%, O2 3-10%, Ar: balance
		if (nameUpper.includes('M2-5')) {
			return 'Argon + CO₂ + O₂ Karışımı (CO₂: 5-15%, O₂: 3-10%, Ar: balance)';
		}
		// M2-6: CO2 15-25%, O2 0.5-3%, Ar: balance
		if (nameUpper.includes('M2-6')) {
			return 'Argon + CO₂ + O₂ Karışımı (CO₂: 15-25%, O₂: 0.5-3%, Ar: balance)';
		}
		// M2-7: CO2 15-25%, O2 3-10%, Ar: balance
		if (nameUpper.includes('M2-7')) {
			return 'Argon + CO₂ + O₂ Karışımı (CO₂: 15-25%, O₂: 3-10%, Ar: balance)';
		}

		// M20 genellikle M1-1 veya M2-0 kategorisinde (CO2 0.5-15%)
		if (nameUpper.includes('M20')) {
			return 'Argon + CO₂ Karışımı (CO₂: 0.5-15%, Ar: balance)-İnce saclar için düşük sıçrantı';
		}

		// M3 Grubu-Yüksek Oksitleyici Bileşenli Argon Bazlı Karışımlar
		// M3-1: CO2 25-50%, Ar: balance
		if (nameUpper.includes('M3-1')) {
			return 'Argon + CO₂ Karışımı (CO₂: 25-50%, Ar: balance)-Yüksek oksitleyici';
		}
		// M3-2: O2 10-15%, Ar: balance
		if (nameUpper.includes('M3-2')) {
			return 'Argon + O₂ Karışımı (O₂: 10-15%, Ar: balance)';
		}
		// M3-3: CO2 25-50%, O2 2-10%, Ar: balance
		if (nameUpper.includes('M3-3')) {
			return 'Argon + CO₂ + O₂ Karışımı (CO₂: 25-50%, O₂: 2-10%, Ar: balance)';
		}
		// M3-4: CO2 5-25%, O2 10-15%, Ar: balance
		if (nameUpper.includes('M3-4')) {
			return 'Argon + CO₂ + O₂ Karışımı (CO₂: 5-25%, O₂: 10-15%, Ar: balance)';
		}
		// M3-5: CO2 25-50%, O2 10-15%, Ar: balance
		if (nameUpper.includes('M3-5')) {
			return 'Argon + CO₂ + O₂ Karışımı (CO₂: 25-50%, O₂: 10-15%, Ar: balance)';
		}

		return '';
	};

	// Dolgu malzemesi açıklamaları
	const getFillerDescription = (classification) => {
		if (!classification) return '';
		const classUpper = classification.toUpperCase();

		// AWS/AWS benzeri kodlar (G3Si1, G4Si1, G2Si1 vb.)
		if (classUpper.includes('G3SI1') || classUpper.includes('G3SI-1')) return 'Karbon Çelik Dolgu Teli (Silisyum içerikli, genel amaçlı)';
		if (classUpper.includes('G4SI1') || classUpper.includes('G4SI-1')) return 'Karbon Çelik Dolgu Teli (Yüksek silisyum içerikli)';
		if (classUpper.includes('G2SI1') || classUpper.includes('G2SI-1')) return 'Karbon Çelik Dolgu Teli (Düşük silisyum içerikli)';
		if (classUpper.includes('G3SI') || classUpper.match(/G\d+SI/)) return 'Karbon Çelik Dolgu Teli (Silisyum içerikli)';

		// ER70S-6, ER70S-3 gibi → Karbon Çelik Dolgu Teli
		if (classUpper.includes('ER70') || classUpper.includes('ER49')) return 'Karbon Çelik Dolgu Teli';
		// ER308L, ER316L gibi → Paslanmaz Çelik Dolgu Teli
		if (classUpper.includes('ER308') || classUpper.includes('ER316') || classUpper.includes('ER309')) return 'Paslanmaz Çelik Dolgu Teli';
		// ER4043, ER5356 gibi → Alüminyum Dolgu Teli
		if (classUpper.includes('ER4043') || classUpper.includes('ER5356') || classUpper.includes('ER5183')) return 'Alüminyum Dolgu Teli';

		// Genel karbon çelik kodları
		if (classUpper.includes('G') && (classUpper.includes('SI') || classUpper.includes('MN'))) return 'Karbon Çelik Dolgu Teli';

		return '';
	};

	// Logo base64 - public klasöründeki logo.png dosyasını kullan
	const localLogoUrl = getLogoUrl('logo.png');
	const mainLogoBase64 = logoCache[localLogoUrl] || localLogoUrl;

	return `
		<div class="report-header">
			 <div class="report-logo">
				<img src="${mainLogoBase64}" alt="Kademe Logo">
			</div>
			<div class="company-title">
				<h1>KADEME A.Ş.</h1>
				<p>Kalite Yönetim Sistemi</p>
			</div>
			<div class="print-info">
				Yazdır: ${record.wps_no || ''}<br>
				Yazdırılma: ${formatDateTime(new Date())}
			</div>
		</div>

		<div class="meta-box">
			<div class="meta-item"><strong>Belge Türü:</strong> WPS Spesifikasyonu</div>
			<div class="meta-item"><strong>WPS No:</strong> ${record.wps_no || '-'}</div>
			<div class="meta-item"><strong>Revizyon:</strong> ${record.revision || '0'}</div>
			<div class="meta-item"><strong>Sistem:</strong> Kademe Kalite Yönetim Sistemi</div>
			<div class="meta-item"><strong>Yayın Tarihi:</strong> ${formatDate(record.wps_date)}</div>
			<div class="meta-item"><strong>Güncelleme:</strong> ${formatDate(record.updated_at)}</div>
		</div>

		<div class="section">
			<h2 class="section-title blue">1. TEMEL BİLGİLER</h2>
			<table class="info-table">
				<tbody>
					<tr><td>Ana Malzeme</td><td>${record.base_material_1?.name || '-'}${getMaterialEquivalent(record.base_material_1?.name) ? ` (${getMaterialEquivalent(record.base_material_1?.name)})` : ''} (${record.base_material_1?.standard || '-'}) / Grup ${record.base_material_1?.iso_15608_group || '-'}</td></tr>
					<tr><td>Malzeme Kalınlığı</td><td>${record.thickness_1 || '-'} mm</td></tr>
					<tr><td>Dolgu Malzemesi</td><td>${record.filler_material?.classification || '-'}${getFillerDescription(record.filler_material?.classification) ? ` (${getFillerDescription(record.filler_material?.classification)})` : ''}</td></tr>
					<tr><td>Kaynak Prosesi</td><td>${record.welding_process_code || '-'}${processCodeMap[record.welding_process_code] ? ` (${processCodeMap[record.welding_process_code]})` : ''}</td></tr>
					<tr><td>Kaynak Pozisyonu</td><td>${record.welding_position || '-'}${positionMap[record.welding_position] ? ` (${positionMap[record.welding_position]})` : ''}</td></tr>
					<tr><td>Birleşim Tipi</td><td>${jointTypeMap[record.joint_type] || record.joint_type || '-'}</td></tr>
					${record.joint_type === 'Butt'
			? `<tr><td>Kaynak Ağzı Tasarımı</td><td>${record.joint_detail || '-'} (${record.joint_detail === 'I' ? 'N/A' : (record.joint_angle || 'N/A') + '°'}) / Kök Aralığı: ${record.root_gap || 'N/A'} mm</td></tr>`
			: record.joint_type === 'Fillet'
				? (() => {
					const thickness = parseFloat(record.thickness_1) || parseFloat(record.thickness_2) || 0;
					const legSize = thickness > 0 ? (thickness * 0.7).toFixed(1) : 'N/A';
					const throatThickness = thickness > 0 ? (thickness * 0.7 * 0.707).toFixed(1) : 'N/A';
					const jointDetailMap = {
						'Standard': 'Standart Köşe Kaynak',
						'Double': 'Çift Köşe Kaynak',
						'Partial': 'Kısmi Nüfuziyetli Köşe Kaynak',
						'Full': 'Tam Nüfuziyetli Köşe Kaynak'
					};
					const jointDetailLabel = jointDetailMap[record.joint_detail] || record.joint_detail || 'Standart Köşe Kaynak';
					return `
								<tr><td>Köşe Kaynak Ağzı Tipi</td><td>${jointDetailLabel}</td></tr>
								<tr><td>Bacak Boyutu</td><td>${legSize} mm</td></tr>
								<tr><td>Boğaz Kalınlığı</td><td>${throatThickness} mm</td></tr>
							`;
				})()
				: ''}
				</tbody>
			</table>
		</div>

		<div class="section">
			<h2 class="section-title red">2. KAYNAK PARAMETRELERİ</h2>
			<table class="info-table">
				<tbody>
					<tr><td>Koruyucu Gaz</td><td>${record.shielding_gas?.name || '-'}${getGasDescription(record.shielding_gas?.name) ? ` (${getGasDescription(record.shielding_gas?.name)})` : ''}</td></tr>
					<tr><td>Gaz Debisi</td><td>${record.gas_flow_rate || '-'} L/dk</td></tr>
					<tr><td>Tel Çapı</td><td>${record.filler_diameter || '-'} mm</td></tr>
					<tr><td>Ön Tav Sıcaklığı</td><td>${record.preheat_temperature || '-'} °C</td></tr>
					<tr><td>Pasolar Arası Sıcaklık</td><td>${record.interpass_temperature || '-'} °C</td></tr>
					<tr><td>Verim (η)</td><td>${record.efficiency || '-'}</td></tr>
				</tbody>
			</table>
		</div>

		<div class="section">
			<h2 class="section-title gray">3. PASO PLANI</h2>
			<table class="pass-table">
				<thead>
					<tr>
						<th>Paso</th>
						<th>Teknik</th>
						<th>Akım Türü</th>
						<th>Akım (A)</th>
						<th>Voltaj (V)</th>
						<th>İlerleme (mm/dk)</th>
						<th>Isı Girdisi (kJ/mm)</th>
					</tr>
				</thead>
				<tbody>${passPlanHtml}</tbody>
			</table>
		</div>
		
		<div class="section">
			 <h2 class="section-title gray">4. NOTLAR</h2>
			 <div class="notes-box">
				<strong>Kaynakçı Notları:</strong>
				<pre>${record.welder_notes || 'Belirtilmemiş.'}</pre>
			 </div>
		</div>

		<div class="section signature-section">
			<h2 class="section-title dark">5. İMZA VE ONAY</h2>
			<div class="signature-area">
				<div class="signature-box">
					<p class="role">HAZIRLAYAN</p>
					<div class="signature-line"></div>
					<p class="name">Atakan BATTAL</p>
					<p class="title">Kaynak Mühendisi</p>
				</div>
				<div class="signature-box">
					<p class="role">KONTROL EDEN</p>
					<div class="signature-line"></div>
					<p class="name">&nbsp;</p>
					<p class="title">Üretim Müdürü</p>
				</div>
				<div class="signature-box">
					<p class="role">ONAYLAYAN</p>
					<div class="signature-line"></div>
					<p class="name">&nbsp;</p>
					<p class="title">Kalite Müdürü</p>
				</div>
			</div>
		</div>
	`;
};

const generatePolyvalenceMatrixHtml = (record) => {
	const formatDate = (dateStr) => dateStr ? format(new Date(dateStr), 'dd.MM.yyyy HH:mm') : '-';

	// Seviye renk konfigürasyonu
	const SKILL_LEVELS = {
		0: { label: 'Bilgi Yok', color: '#e5e7eb', textColor: '#6b7280', description: 'Eğitim almamış / Bilgi yok' },
		1: { label: 'Temel', color: '#fecaca', textColor: '#991b1b', description: 'Temel bilgi sahibi / Gözlemci' },
		2: { label: 'Gözetimli', color: '#fef08a', textColor: '#854d0e', description: 'Gözetim altında çalışabilir' },
		3: { label: 'Bağımsız', color: '#bbf7d0', textColor: '#166534', description: 'Bağımsız çalışabilir' },
		4: { label: 'Eğitmen', color: '#bfdbfe', textColor: '#1e40af', description: 'Eğitmen / Mentor seviyesi' }
	};

	// Skill'leri kategoriye göre grupla
	const skillsByCategory = {};
	(record.skills || []).forEach(skill => {
		const categoryName = skill.category?.name || 'Diğer';
		if (!skillsByCategory[categoryName]) {
			skillsByCategory[categoryName] = [];
		}
		skillsByCategory[categoryName].push(skill);
	});

	// Polivalans skoru hesaplama
	// Polivalans skoru: Kişinin sahip olduğu yetkinlikler içinde seviye 3+ olanların oranı
	const calculatePolyvalenceScore = (personnelId) => {
		const personSkills = (record.personnelSkills || []).filter(ps => ps.personnel_id === personnelId);
		if (personSkills.length === 0) return 0;
		// Seviye 3 ve üzeri yetkin kabul edilir
		const proficientSkills = personSkills.filter(ps => ps.current_level >= 3).length;
		// Kişinin sahip olduğu yetkinlikler içinde yetkin olanların oranı
		return Math.round((proficientSkills / personSkills.length) * 100);
	};

	// Personel-Skill mapping
	const getPersonnelSkill = (personnelId, skillId) => {
		return (record.personnelSkills || []).find(ps => ps.personnel_id === personnelId && ps.skill_id === skillId);
	};

	// Matris tablosu oluştur
	const matrixTableHtml = `
		<table class="matrix-table" style="width: 100%; border-collapse: collapse; font-size: 9px; margin-top: 15px;">
			<thead>
				<tr style="background-color: #f3f4f6;">
					<th rowspan="2" style="border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: middle; min-width: 120px; position: sticky; left: 0; background-color: #f3f4f6; z-index: 10;">
						<strong>Personel</strong>
					</th>
					${Object.keys(skillsByCategory).map(categoryName => {
		const categorySkills = skillsByCategory[categoryName];
		return `<th colspan="${categorySkills.length}" style="border: 1px solid #d1d5db; padding: 6px; text-align: center; background-color: #dbeafe; color: #1e40af; font-weight: 600;">
							${categoryName}
						</th>`;
	}).join('')}
					<th rowspan="2" style="border: 1px solid #d1d5db; padding: 6px; text-align: center; background-color: #dbeafe; min-width: 60px;">
						<strong>Polivalans<br>Skoru</strong>
					</th>
				</tr>
				<tr style="background-color: #f9fafb;">
					${(record.skills || []).map(skill => `
						<th style="border: 1px solid #d1d5db; padding: 4px; text-align: center; font-size: 8px; max-width: 60px; word-wrap: break-word;">
							${skill.code || skill.name}
							${skill.requires_certification ? '<br><small style="font-size: 7px;">SERT.</small>' : ''}
							${skill.is_critical ? '<br><small style="font-size: 7px;">KRİT.</small>' : ''}
						</th>
					`).join('')}
				</tr>
			</thead>
			<tbody>
				${(record.personnel || []).map((person, idx) => {
		const polyvalenceScore = calculatePolyvalenceScore(person.id);
		return `
						<tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#fafafa'};">
							<td style="border: 1px solid #d1d5db; padding: 6px; font-weight: 600; position: sticky; left: 0; background-color: ${idx % 2 === 0 ? '#ffffff' : '#fafafa'}; z-index: 5;">
								${person.full_name}<br>
								<small style="color: #6b7280; font-weight: normal;">${person.department || ''} ${person.job_title ? '• ' + person.job_title : ''}</small>
							</td>
							${(record.skills || []).map(skill => {
			const personnelSkill = getPersonnelSkill(person.id, skill.id);
			const level = personnelSkill?.current_level || 0;
			const levelConfig = SKILL_LEVELS[level];
			const isCertified = personnelSkill?.is_certified;
			const needsTraining = personnelSkill?.training_required;

			return `
									<td style="border: 1px solid #d1d5db; padding: 4px; text-align: center; background-color: ${levelConfig.color}; color: ${levelConfig.textColor};">
										<strong style="font-size: 14px;">${level}</strong>
										${isCertified ? '<br><small style="font-size: 7px;">S</small>' : ''}
										${needsTraining ? '<br><small style="font-size: 7px;">E</small>' : ''}
									</td>
								`;
		}).join('')}
							<td style="border: 1px solid #d1d5db; padding: 6px; text-align: center; background-color: #dbeafe; font-weight: 700; color: #1e40af; font-size: 11px;">
								${polyvalenceScore}%
							</td>
						</tr>
					`;
	}).join('')}
			</tbody>
		</table>
	`;

	// Seviye legend
	const legendHtml = `
		<div style="margin-top: 20px; padding: 15px; background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
			<h4 style="margin: 0 0 10px 0; font-size: 11px; font-weight: 700;">Yetkinlik Seviyeleri</h4>
			<div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px;">
				${Object.entries(SKILL_LEVELS).map(([level, config]) => `
					<div style="padding: 8px; border-radius: 4px; background-color: ${config.color}; color: ${config.textColor}; text-align: center;">
						<div style="font-size: 16px; font-weight: 700;">${level}</div>
						<div style="font-size: 9px;">${config.label}</div>
					</div>
				`).join('')}
			</div>
			<div style="margin-top: 10px; font-size: 9px; color: #6b7280;">
				<strong>Simgeler:</strong> SERT. = Sertifika Gerekli | KRİT. = Kritik Yetkinlik | S = Sertifikalı | E = Eğitim Gerekli
			</div>
		</div>
	`;

	// Özet istatistikler
	const summaryHtml = `
		<div style="margin-top: 15px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
			<div style="padding: 12px; background-color: #eff6ff; border-radius: 6px; border: 1px solid #bfdbfe;">
				<div style="font-size: 20px; font-weight: 700; color: #1e40af; margin-bottom: 3px;">${record.personnel?.length || 0}</div>
				<div style="font-size: 9px; color: #1e40af;">Toplam Personel</div>
			</div>
			<div style="padding: 12px; background-color: #f0fdf4; border-radius: 6px; border: 1px solid #bbf7d0;">
				<div style="font-size: 20px; font-weight: 700; color: #166534; margin-bottom: 3px;">${record.skills?.length || 0}</div>
				<div style="font-size: 9px; color: #166534;">Toplam Yetkinlik</div>
			</div>
			<div style="padding: 12px; background-color: #fef3c7; border-radius: 6px; border: 1px solid #fde047;">
				<div style="font-size: 20px; font-weight: 700; color: #854d0e; margin-bottom: 3px;">${record.summary?.avgPolyvalence || 0}%</div>
				<div style="font-size: 9px; color: #854d0e;">Ortalama Polivalans</div>
			</div>
		</div>
	`;

	// Yetkinlik Tanımları Tablosu (Son sayfa için)
	const skillDefinitionsHtml = `
		<div class="section" style="page-break-before: always;">
			<h2 class="section-title blue">YETKİNLİK TANIMLARI</h2>
			<table class="info-table" style="width: 100%; border-collapse: collapse; margin-top: 15px;">
				<thead>
					<tr style="background-color: #f3f4f6;">
						<th style="border: 1px solid #d1d5db; padding: 8px; text-align: left; width: 15%;">Kod</th>
						<th style="border: 1px solid #d1d5db; padding: 8px; text-align: left; width: 25%;">Yetkinlik Adı</th>
						<th style="border: 1px solid #d1d5db; padding: 8px; text-align: left; width: 20%;">Kategori</th>
						<th style="border: 1px solid #d1d5db; padding: 8px; text-align: left; width: 40%;">Açıklama</th>
					</tr>
				</thead>
				<tbody>
					${(record.skills || []).map(skill => `
						<tr>
							<td style="border: 1px solid #d1d5db; padding: 6px; font-weight: 600; font-family: monospace;">${skill.code || '-'}</td>
							<td style="border: 1px solid #d1d5db; padding: 6px;">
								${skill.name}
								${skill.requires_certification ? '<br><small style="color: #7c3aed; font-weight: 600;">Sertifika Gerekli</small>' : ''}
								${skill.is_critical ? '<br><small style="color: #dc2626; font-weight: 600;">Kritik Yetkinlik</small>' : ''}
							</td>
							<td style="border: 1px solid #d1d5db; padding: 6px; font-size: 9px;">${skill.category?.name || 'Diğer'}</td>
							<td style="border: 1px solid #d1d5db; padding: 6px; font-size: 9px;">${skill.description || '-'}</td>
						</tr>
					`).join('')}
				</tbody>
			</table>
			
			<div style="margin-top: 20px; padding: 12px; background-color: #f9fafb; border-radius: 6px; border-left: 4px solid #3b82f6;">
				<h3 style="margin: 0 0 10px 0; font-size: 11px; font-weight: 700; color: #1f2937;">Seviye Tanımları</h3>
				<table style="width: 100%; border-collapse: collapse;">
					<thead>
						<tr style="background-color: #e5e7eb;">
							<th style="border: 1px solid #d1d5db; padding: 6px; text-align: center; width: 10%;">Seviye</th>
							<th style="border: 1px solid #d1d5db; padding: 6px; text-align: left; width: 20%;">Tanım</th>
							<th style="border: 1px solid #d1d5db; padding: 6px; text-align: left; width: 70%;">Açıklama</th>
						</tr>
					</thead>
					<tbody>
						${Object.entries(SKILL_LEVELS).map(([level, config]) => `
							<tr>
								<td style="border: 1px solid #d1d5db; padding: 6px; text-align: center; background-color: ${config.color}; color: ${config.textColor}; font-weight: 700; font-size: 14px;">${level}</td>
								<td style="border: 1px solid #d1d5db; padding: 6px; font-weight: 600; font-size: 10px;">${config.label}</td>
								<td style="border: 1px solid #d1d5db; padding: 6px; font-size: 9px;">${config.description}</td>
							</tr>
						`).join('')}
					</tbody>
				</table>
			</div>
		</div>
	`;

	// Logo base64 - public klasöründeki logo.png dosyasını kullan
	const localLogoUrl = getLogoUrl('logo.png');
	const mainLogoBase64 = logoCache[localLogoUrl] || localLogoUrl;

	return `
		<div class="report-header">
			<div class="report-logo">
				<img src="${mainLogoBase64}" alt="Kademe Logo">
			</div>
			<div class="company-title">
				<h1>KADEME A.Ş.</h1>
				<p>Polivalans Matrisi Raporu</p>
			</div>
			<div class="print-info">
				Rapor Tarihi: ${formatDate(new Date())}
			</div>
		</div>

		<div class="meta-box">
			<div class="meta-item"><strong>Belge Türü:</strong> Polivalans Matrisi</div>
			<div class="meta-item"><strong>Form No:</strong> FR-EGT-003</div>
			<div class="meta-item"><strong>Rapor Tarihi:</strong> ${formatDate(new Date())}</div>
			${record.filters?.department ? `<div class="meta-item"><strong>Departman Filtresi:</strong> ${record.filters.department}</div>` : ''}
			${record.filters?.category ? `<div class="meta-item"><strong>Kategori Filtresi:</strong> ${record.filters.category}</div>` : ''}
			${record.filters?.searchTerm ? `<div class="meta-item"><strong>Arama:</strong> "${record.filters.searchTerm}"</div>` : ''}
		</div>

		<div class="section">
			<h2 class="section-title blue">ÖZET İSTATİSTİKLER</h2>
			${summaryHtml}
		</div>

		<div class="section">
			<h2 class="section-title green">POLİVALANS MATRİSİ</h2>
			${matrixTableHtml}
		</div>
		
		${(record.certificationAlerts && record.certificationAlerts.length > 0) ? `
			<div class="section" style="page-break-before: auto;">
				<h2 class="section-title red">SERTİFİKA UYARILARI</h2>
				<table class="info-table">
					<thead>
						<tr style="background-color: #f3f4f6;">
							<th style="border: 1px solid #d1d5db; padding: 6px;">Personel</th>
							<th style="border: 1px solid #d1d5db; padding: 6px;">Yetkinlik</th>
							<th style="border: 1px solid #d1d5db; padding: 6px;">Son Geçerlilik</th>
							<th style="border: 1px solid #d1d5db; padding: 6px;">Durum</th>
						</tr>
					</thead>
					<tbody>
						${record.certificationAlerts.map(alert => `
							<tr>
								<td style="border: 1px solid #d1d5db; padding: 6px;">${alert.personnel_name || '-'}</td>
								<td style="border: 1px solid #d1d5db; padding: 6px;">${alert.skill_name || '-'}</td>
								<td style="border: 1px solid #d1d5db; padding: 6px;">${alert.expiry_date ? format(new Date(alert.expiry_date), 'dd.MM.yyyy') : '-'}</td>
								<td style="border: 1px solid #d1d5db; padding: 6px; color: #dc2626; font-weight: 600;">${alert.alert_type || 'Dikkat'}</td>
							</tr>
						`).join('')}
					</tbody>
				</table>
			</div>
		` : ''}

		${skillDefinitionsHtml}
		
		<div class="section signature-section">
		<h2 class="section-title dark">İMZA VE ONAY</h2>
		<div class="signature-area">
			<div class="signature-box">
				<p class="role">HAZIRLAYAN</p>
				<div class="signature-line"></div>
			</div>
			<div class="signature-box">
				<p class="role">KONTROL EDEN</p>
				<div class="signature-line"></div>
			</div>
			<div class="signature-box">
				<p class="role">ONAYLAYAN</p>
				<div class="signature-line"></div>
			</div>
		</div>
	</div>
	`;
};

const generateListReportHtml = (record, type) => {
	const formatDate = (dateStr) => dateStr ? format(new Date(dateStr), 'dd.MM.yyyy') : '-';
	const formatDateTime = (dateStr) => dateStr ? format(new Date(dateStr), 'dd.MM.yyyy HH:mm') : '-';
	const escapeHtml = (value) => String(value ?? '-')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
	const getFixtureImageUrl = (imagePaths) => {
		const firstImagePath = Array.isArray(imagePaths) ? imagePaths.find(Boolean) : null;
		if (!firstImagePath) return null;
		const { data } = supabase.storage.from('incoming_control').getPublicUrl(firstImagePath);
		return data?.publicUrl || null;
	};

	let title = '';
	let headers = [];
	let rowsHtml = '';
	let totalCount = record.items ? record.items.length : (record.allRecords ? record.allRecords.length : 0);
	let summaryHtml = '';

	if (type === 'nonconformity_executive') {
		// Yönetici özet raporu için özel HTML
		const kpiStats = record.kpiStats || {};
		const kpiHtml = `
			<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 25px;">
				<div style="background-color: #dbeafe; border: 2px solid #3b82f6; border-radius: 8px; padding: 15px; text-align: center;">
					<div style="font-size: 11px; color: #1e40af; font-weight: 600; margin-bottom: 5px;">AÇIK</div>
					<div style="font-size: 24px; font-weight: 700; color: #1e40af;">${kpiStats.open || 0}</div>
				</div>
				<div style="background-color: #d1fae5; border: 2px solid #10b981; border-radius: 8px; padding: 15px; text-align: center;">
					<div style="font-size: 11px; color: #065f46; font-weight: 600; margin-bottom: 5px;">KAPALI</div>
					<div style="font-size: 24px; font-weight: 700; color: #065f46;">${kpiStats.closed || 0}</div>
				</div>
				<div style="background-color: #fee2e2; border: 2px solid #ef4444; border-radius: 8px; padding: 15px; text-align: center;">
					<div style="font-size: 11px; color: #991b1b; font-weight: 600; margin-bottom: 5px;">REDDEDİLDİ</div>
					<div style="font-size: 24px; font-weight: 700; color: #991b1b;">${kpiStats.rejected || 0}</div>
				</div>
				<div style="background-color: #fed7aa; border: 2px solid #f97316; border-radius: 8px; padding: 15px; text-align: center;">
					<div style="font-size: 11px; color: #9a3412; font-weight: 600; margin-bottom: 5px;">GECİKEN</div>
					<div style="font-size: 24px; font-weight: 700; color: #9a3412;">${kpiStats.overdue || 0}</div>
				</div>
			</div>
			<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px;">
				<div style="background-color: #e0e7ff; border: 2px solid #6366f1; border-radius: 8px; padding: 15px; text-align: center;">
					<div style="font-size: 11px; color: #3730a3; font-weight: 600; margin-bottom: 5px;">DF</div>
					<div style="font-size: 20px; font-weight: 700; color: #3730a3;">${kpiStats.DF || 0}</div>
				</div>
				<div style="background-color: #f3e8ff; border: 2px solid #9333ea; border-radius: 8px; padding: 15px; text-align: center;">
					<div style="font-size: 11px; color: #6b21a8; font-weight: 600; margin-bottom: 5px;">8D</div>
					<div style="font-size: 20px; font-weight: 700; color: #6b21a8;">${kpiStats['8D'] || 0}</div>
				</div>
				<div style="background-color: #fce7f3; border: 2px solid #ec4899; border-radius: 8px; padding: 15px; text-align: center;">
					<div style="font-size: 11px; color: #9f1239; font-weight: 600; margin-bottom: 5px;">MDI</div>
					<div style="font-size: 20px; font-weight: 700; color: #9f1239;">${kpiStats.MDI || 0}</div>
				</div>
			</div>
		`;

		const deptPerformanceHtml = record.deptPerformance && record.deptPerformance.length > 0
			? `
				<table class="info-table results-table" style="margin-top: 15px;">
					<thead>
						<tr>
							<th>Birim</th>
							<th style="text-align: center;">Açık</th>
							<th style="text-align: center;">Kapalı</th>
							<th style="text-align: center;">Geciken</th>
							<th style="text-align: right;">Ort. Kapatma (Gün)</th>
						</tr>
					</thead>
					<tbody>
						${record.deptPerformance.map(dept => `
							<tr>
								<td style="font-weight: 600;">${dept.unit}</td>
								<td style="text-align: center;">${dept.open}</td>
								<td style="text-align: center;">${dept.closed}</td>
								<td style="text-align: center; font-weight: 600; color: #dc2626;">${dept.overdue}</td>
								<td style="text-align: right;">${dept.avgClosureTime}</td>
							</tr>
						`).join('')}
					</tbody>
				</table>
			`
			: '<p style="color: #6b7280; font-style: italic;">Birim performans verisi bulunamadı.</p>';

		const requesterContributionHtml = record.requesterContribution && record.requesterContribution.length > 0
			? `
				<table class="info-table results-table" style="margin-top: 15px;">
					<thead>
						<tr>
							<th>Talep Eden Birim</th>
							<th style="text-align: center;">Toplam</th>
							<th style="text-align: center;">DF</th>
							<th style="text-align: center;">8D</th>
							<th style="text-align: center;">MDI</th>
							<th style="text-align: right;">Katkı %</th>
						</tr>
					</thead>
					<tbody>
						${record.requesterContribution.map(req => `
							<tr>
								<td style="font-weight: 600;">${req.unit}</td>
								<td style="text-align: center;">${req.total}</td>
								<td style="text-align: center;">${req.DF}</td>
								<td style="text-align: center;">${req['8D']}</td>
								<td style="text-align: center;">${req.MDI}</td>
								<td style="text-align: right; font-weight: 600;">%${req.contribution}</td>
							</tr>
						`).join('')}
					</tbody>
				</table>
			`
			: '<p style="color: #6b7280; font-style: italic;">Talep eden birim verisi bulunamadı.</p>';

		const overdueRecordsHtml = record.overdueRecords && record.overdueRecords.length > 0
			? `
				<table class="info-table results-table" style="margin-top: 15px;">
					<thead>
						<tr>
							<th>No</th>
							<th>Tip</th>
							<th>Konu</th>
							<th>Birim</th>
							<th>Termin</th>
							<th style="text-align: right;">Gecikme (Gün)</th>
						</tr>
					</thead>
					<tbody>
						${record.overdueRecords.map(rec => `
							<tr>
								<td style="font-weight: 600;">${rec.nc_number}</td>
								<td style="text-align: center;">
									${rec.type === 'DF' ? '<span style="padding: 2px 6px; border-radius: 4px; font-size: 0.7em; font-weight: 600; background-color: #3b82f6; color: white;">DF</span>' :
					rec.type === '8D' ? '<span style="padding: 2px 6px; border-radius: 4px; font-size: 0.7em; font-weight: 600; background-color: #9333ea; color: white;">8D</span>' :
						rec.type === 'MDI' ? '<span style="padding: 2px 6px; border-radius: 4px; font-size: 0.7em; font-weight: 600; background-color: #4f46e5; color: white;">MDI</span>' : rec.type}
								</td>
								<td>${rec.title}</td>
								<td>${rec.department}</td>
								<td>${rec.due_date}</td>
								<td style="text-align: right; font-weight: 700; color: #dc2626;">${rec.days_overdue}</td>
							</tr>
						`).join('')}
					</tbody>
				</table>
			`
			: '<p style="color: #10b981; font-weight: 600; text-align: center; padding: 20px;">✓ Geciken kayıt bulunmuyor.</p>';

		const statusSummary = Object.entries(record.statusDistribution || {})
			.map(([status, count]) => `<span style="margin-right: 15px;"><strong>${status}:</strong> ${count}</span>`)
			.join('');
		const typeSummary = Object.entries(record.typeDistribution || {})
			.map(([type, count]) => `<span style="margin-right: 15px;"><strong>${type}:</strong> ${count}</span>`)
			.join('');

		summaryHtml = `
			<p><strong>Toplam Kayıt Sayısı:</strong> ${record.totalRecords || 0}</p>
			${record.departmentSelectionLabel ? `<p><strong>Seçilen Birimler:</strong> ${record.departmentSelectionLabel}</p>` : ''}
			${statusSummary ? `<p><strong>Durum Dağılımı:</strong> ${statusSummary}</p>` : ''}
			${typeSummary ? `<p><strong>Tip Dağılımı:</strong> ${typeSummary}</p>` : ''}
		`;

		const allRecordsHtml = record.allRecords && record.allRecords.length > 0
			? `
				<table class="info-table results-table">
					<thead>
						<tr>
							<th style="width: 10%;">No</th>
							<th style="width: 6%;">Tip</th>
							<th style="width: 20%;">Problem</th>
							<th style="width: 12%;">Departman</th>
							<th style="width: 10%;">Açılış</th>
							<th style="width: 10%;">Kapanış</th>
							<th style="width: 10%;">Termin</th>
							<th style="width: 12%;">Durum</th>
							<th style="width: 10%;">Sorumlu</th>
						</tr>
					</thead>
					<tbody>
						${record.allRecords.map(item => {
				const statusBadge = item.status === 'Kapatıldı'
					? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #d1fae5; color: #065f46;">Kapatıldı</span>'
					: item.status === 'Reddedildi'
						? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #fee2e2; color: #991b1b;">Reddedildi</span>'
						: item.status === 'Gecikmiş'
							? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #fee2e2; color: #991b1b;">Gecikmiş</span>'
							: item.status === 'İşlemde'
								? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #fef3c7; color: #92400e;">İşlemde</span>'
								: item.status === 'Onay Bekliyor'
									? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #dbeafe; color: #1e40af;">Onay Bekliyor</span>'
									: '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #e5e7eb; color: #374151;">Açık</span>';

				const typeBadge = item.type === 'DF'
					? '<span style="padding: 2px 6px; border-radius: 4px; font-size: 0.7em; font-weight: 600; background-color: #3b82f6; color: white;">DF</span>'
					: item.type === '8D'
						? '<span style="padding: 2px 6px; border-radius: 4px; font-size: 0.7em; font-weight: 600; background-color: #9333ea; color: white;">8D</span>'
						: item.type === 'MDI'
							? '<span style="padding: 2px 6px; border-radius: 4px; font-size: 0.7em; font-weight: 600; background-color: #4f46e5; color: white;">MDI</span>'
							: item.type;

				return `
								<tr>
									<td style="white-space: nowrap; font-weight: 600;">${item.nc_number}</td>
									<td style="text-align: center;">${typeBadge}</td>
									<td><strong>${item.title}</strong></td>
									<td>${item.department}</td>
									<td style="white-space: nowrap;">${item.opening_date}</td>
									<td style="white-space: nowrap;">${item.closing_date}</td>
									<td style="white-space: nowrap;">${item.due_date}</td>
									<td>${statusBadge}</td>
									<td style="font-size: 0.85em;">${item.responsible_person}</td>
								</tr>
							`;
			}).join('')}
					</tbody>
				</table>
			`
			: '<p style="color: #6b7280; font-style: italic;">Kayıt bulunamadı.</p>';

		return `
			<div class="section">
				<h2 class="section-title blue">GENEL İSTATİSTİKLER</h2>
				${kpiHtml}
			</div>

			<div class="section">
				<h2 class="section-title blue">BİRİM BAZLI PERFORMANS</h2>
				${deptPerformanceHtml}
			</div>

			<div class="section">
				<h2 class="section-title blue">TALEP EDEN BİRİM KATKISI</h2>
				${requesterContributionHtml}
			</div>

			<div class="section">
				<h2 class="section-title red">TERMİN SÜRESİ GECİKEN UYGUNSUZLUKLAR</h2>
				${overdueRecordsHtml}
			</div>

			<div class="section">
				<h2 class="section-title blue">TÜM KAYITLAR</h2>
				<div class="list-summary">${summaryHtml}</div>
				${allRecordsHtml}
			</div>
		`;
	} else if (type === 'quarantine_list') {
		title = 'Genel Karantina Raporu';
		headers = ['Tarih', 'Parça Bilgileri', 'Miktar', 'Durum', 'Sorumlu Birim', 'Açıklama'];
		rowsHtml = record.items.map(item => `
			<tr>
				<td style="white-space: nowrap; width: 10%;">${formatDate(item.quarantine_date)}</td>
				<td style="width: 20%;">
					<strong style="font-size: 0.9em;">${item.part_name || '-'}</strong><br>
					<small class="muted" style="font-size: 0.75em;">Kod: ${item.part_code || '-'}</small><br>
					<small class="muted" style="font-size: 0.75em;">Lot: ${item.lot_no || '-'}</small>
				</td>
				<td style="text-align: center; width: 8%; white-space: nowrap;"><strong>${item.quantity || '0'}</strong> ${item.unit || 'Adet'}</td>
				<td style="width: 10%;"><span style="padding: 3px 6px; border-radius: 4px; font-size: 0.75em; font-weight: 600; white-space: nowrap; display: inline-block; ${item.status === 'Karantinada' ? 'background-color: #fee2e2; color: #991b1b;' :
				item.status === 'Tamamlandı' ? 'background-color: #d1fae5; color: #065f46;' :
					item.status === 'Serbest Bırakıldı' ? 'background-color: #dbeafe; color: #1e40af;' :
						'background-color: #e5e7eb; color: #374151;'
			}">${item.status || 'Bilinmiyor'}</span></td>
				<td style="width: 12%; font-size: 0.85em;">
					<strong>${item.source_department || '-'}</strong><br>
					<small class="muted" style="font-size: 0.8em;">Talep: ${item.requesting_department || '-'}</small>
				</td>
				<td style="width: 40%; font-size: 0.8em;"><pre style="white-space: pre-wrap; word-wrap: break-word; margin: 0; font-family: inherit; line-height: 1.3;">${item.description || '-'}</pre></td>
			</tr>
		`).join('');

		// Durum bazlı özet
		const statusCounts = record.items.reduce((acc, item) => {
			acc[item.status] = (acc[item.status] || 0) + 1;
			return acc;
		}, {});
		const statusSummary = Object.entries(statusCounts)
			.map(([status, count]) => `<span style="margin-right: 15px;"><strong>${status}:</strong> ${count}</span>`)
			.join('');

		summaryHtml = `
			<p><strong>Toplam Kayıt Sayısı:</strong> ${totalCount}</p>
			<p><strong>Durum Dağılımı:</strong> ${statusSummary}</p>
		`;
	} else if (type === 'equipment_list') {
		title = 'Ekipman ve Kalibrasyon Listesi Raporu';
		headers = ['Ekipman Adı', 'Seri No', 'Durum', 'Kalibrasyon Durumu', 'Sonraki Kalibrasyon', 'Model', 'Ölçüm Aralığı', 'Sorumlu Birim', 'Zimmet Durumu'];
		rowsHtml = record.items.map(item => {
			const statusBadge = item.status === 'Aktif'
				? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #d1fae5; color: #065f46;">Aktif</span>'
				: item.status === 'Zimmetli'
					? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #dbeafe; color: #1e40af;">Zimmetli</span>'
					: item.status === 'Bakımda'
						? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #fef3c7; color: #92400e;">Bakımda</span>'
						: item.status === 'Kullanım Dışı'
							? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #fee2e2; color: #991b1b;">Kullanım Dışı</span>'
							: item.status === 'Hurdaya Ayrıldı'
								? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #fee2e2; color: #991b1b;">Hurdaya Ayrıldı</span>'
								: '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #e5e7eb; color: #374151;">' + (item.status || '-') + '</span>';

			const calStatusBadge = item.calibration_status?.includes('Geçmiş')
				? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #fee2e2; color: #991b1b;">' + item.calibration_status + '</span>'
				: item.calibration_status?.includes('Yaklaşıyor')
					? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #fef3c7; color: #92400e;">' + item.calibration_status + '</span>'
					: item.calibration_status === 'Tamam'
						? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #d1fae5; color: #065f46;">Tamam</span>'
						: '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #e5e7eb; color: #374151;">' + (item.calibration_status || '-') + '</span>';

			return `
				<tr>
					<td style="width: 15%; font-weight: 600;">${item.name}</td>
					<td style="width: 10%; font-family: monospace; font-size: 0.9em;">${item.serial_number}</td>
					<td style="width: 10%;">${statusBadge}</td>
					<td style="width: 12%;">${calStatusBadge}</td>
					<td style="width: 10%; white-space: nowrap;">${item.next_calibration_date}</td>
					<td style="width: 11%; font-size: 0.85em;">${item.model || item.brand_model || '-'}</td>
					<td style="width: 12%; font-size: 0.85em;">${item.measurement_range || '-'}</td>
					<td style="width: 10%; font-size: 0.85em;">${item.responsible_unit}</td>
					<td style="width: 10%; font-size: 0.85em;">${item.assigned_personnel || '-'}</td>
				</tr>
			`;
		}).join('');

		// Durum bazlı özet
		const statusCounts = record.items.reduce((acc, item) => {
			acc[item.status] = (acc[item.status] || 0) + 1;
			return acc;
		}, {});
		const statusSummary = Object.entries(statusCounts)
			.map(([status, count]) => `<span style="margin-right: 15px;"><strong>${status}:</strong> ${count}</span>`)
			.join('');

		// Kalibrasyon durumu bazlı özet
		const calStatusCounts = record.items.reduce((acc, item) => {
			const calStatus = item.calibration_status || 'Bilinmiyor';
			acc[calStatus] = (acc[calStatus] || 0) + 1;
			return acc;
		}, {});
		const calStatusSummary = Object.entries(calStatusCounts)
			.map(([status, count]) => `<span style="margin-right: 15px;"><strong>${status}:</strong> ${count}</span>`)
			.join('');

		summaryHtml = `
			<p><strong>Toplam Ekipman Sayısı:</strong> ${totalCount}</p>
			${statusSummary ? `<p><strong>Durum Dağılımı:</strong> ${statusSummary}</p>` : ''}
			${calStatusSummary ? `<p><strong>Kalibrasyon Durumu:</strong> ${calStatusSummary}</p>` : ''}
			${record.filterInfo ? `<p><strong>Filtre:</strong> ${record.filterInfo}</p>` : ''}
		`;
	} else if (type === 'kpi_list') {
		title = record.title || 'KPI Performans Raporu';
		const kpiCategoryLabel = (cat) => {
			const id = cat != null && String(cat).trim() !== '' ? String(cat).trim() : null;
			const found = KPI_CATEGORIES.find((c) => c.id === id);
			return found ? found.label : (id && id !== 'default' ? id : 'Genel');
		};
		const targetDirLabel = (dir) => (dir === 'decrease' ? 'Düşük değer tercih edilir' : 'Yüksek değer tercih edilir');
		headers = ['KPI Adı', 'Kategori', 'Hedef', 'Güncel Değer', 'Birim', 'Hedef Yönü', 'Performans özeti (12 ay)'];
		const kpiItems = record.items || [];
		rowsHtml = kpiItems.map((k) => {
			const cur = k.current_value != null && k.current_value !== '' ? String(k.current_value) : '—';
			const tgt = k.target_value != null && k.target_value !== '' ? String(k.target_value) : '—';
			const unit = (k.unit && String(k.unit).trim()) ? String(k.unit).trim() : '—';
			const catTr = k.category_label ? String(k.category_label) : kpiCategoryLabel(k.category);
			const dir = k.target_direction === 'increase' || k.target_direction === 'decrease' ? k.target_direction : 'decrease';
			const lines = Array.isArray(k.performance_lines) && k.performance_lines.length > 0
				? k.performance_lines
				: (k.performance_summary ? [String(k.performance_summary)] : ['—']);
			const perfCell = lines.map((line) => escapeHtml(line)).join('<br/>');
			return `
				<tr>
					<td style="font-weight: 600;">${escapeHtml(k.name || '-')}</td>
					<td>${escapeHtml(catTr)}</td>
					<td style="text-align: right;">${escapeHtml(tgt)}</td>
					<td style="text-align: right;">${escapeHtml(cur)}</td>
					<td>${escapeHtml(unit)}</td>
					<td style="font-size: 0.9em;">${escapeHtml(targetDirLabel(dir))}</td>
					<td style="font-size: 0.88em; line-height: 1.45;">${perfCell}</td>
				</tr>
			`;
		}).join('');
		const perfOk = kpiItems.filter((i) => i.meets_target === true).length;
		const perfGap = kpiItems.filter((i) => i.meets_target === false).length;
		const perfUndecided = kpiItems.filter((i) => i.meets_target !== true && i.meets_target !== false).length;
		const eksikPart = perfUndecided > 0 ? `, ${perfUndecided} tanımsız` : '';
		summaryHtml = `
			<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px;">
				<p style="margin: 0; font-size: 13px; color: #334155; line-height: 1.5;">
					<strong>${totalCount}</strong> KPI —
					<span style="color:#15803d;">${perfOk} uygun</span>,
					<span style="color:#b91c1c;">${perfGap} sapma</span>${eksikPart}
				</p>
			</div>
			${record.filterInfo ? `<p style="margin:0 0 8px 0; font-size: 12px; color: #64748b;">${escapeHtml(record.filterInfo)}</p>` : ''}
		`;
	} else if (type === 'leak_test_list') {
		title = record.title || 'Sızdırmazlık Test Listesi Raporu';
		headers = ['Kayıt No', 'Test Tarihi', 'Sonuç', 'Parça Kodu', 'Şasi/Seri', 'Tank', 'Sızıntı', 'Test Eden', 'Kaynak Eden'];
		rowsHtml = (record.items || []).map((r) => `
			<tr>
				<td style="font-weight: 600;">${escapeHtml(r.record_number)}</td>
				<td>${escapeHtml(formatDate(r.test_date))}</td>
				<td>${escapeHtml(r.test_result || '-')}</td>
				<td>${escapeHtml(r.part_code || '-')}</td>
				<td>${escapeHtml(r.vehicle_serial_number || '-')}</td>
				<td>${escapeHtml(r.tank_type || '-')}</td>
				<td style="text-align: center;">${r.leak_count != null ? escapeHtml(String(r.leak_count)) : '-'}</td>
				<td>${escapeHtml(r.tested_by_name || '-')}</td>
				<td>${escapeHtml(r.welded_by_name || '-')}</td>
			</tr>
		`).join('');
		const leakItems = record.items || [];
		const leakN = leakItems.length;
		const leakPass = leakItems.filter((r) => {
			const s = String(r.test_result || '').toLowerCase();
			return s.includes('geçti') || s.includes('uygun') || s.includes('ok') || s.includes('başarı') || s.includes('basari');
		}).length;
		const leakFail = leakItems.filter((r) => {
			const s = String(r.test_result || '').toLowerCase();
			return s.includes('geçmedi') || s.includes('uygunsuz') || s.includes('red') || s.includes('fail');
		}).length;
		const leakAmbiguous = Math.max(0, leakN - leakPass - leakFail);
		const leakPassRate = leakN > 0 ? ((leakPass / leakN) * 100).toFixed(1) : '0';
		summaryHtml = `
			<p><strong>Toplam kayıt:</strong> ${totalCount}</p>
			<p><strong>Tahmini geçen / uygun sonuç:</strong> ${leakPass} (${leakPassRate}%)</p>
			<p><strong>Tahmini geçmeyen / uygunsuz:</strong> ${leakFail}</p>
			${leakAmbiguous > 0 ? `<p><strong>Sonuç metni eşleşmeyen:</strong> ${leakAmbiguous} (test_result alanını standartlaştırın)</p>` : ''}
			${record.filterInfo ? `<p><strong>Filtre:</strong> ${escapeHtml(record.filterInfo)}</p>` : ''}
		`;
	} else if (type === 'process_inspection_list') {
		title = record.title || 'Proses Muayene Listesi Raporu';
		headers = ['Kayıt No', 'Parça Kodu', 'Muayene Tarihi', 'Karar', 'Operatör'];
		rowsHtml = (record.items || []).map((r) => `
			<tr>
				<td style="font-weight: 600;">${escapeHtml(r.record_no || '-')}</td>
				<td>${escapeHtml(r.part_code || '-')}</td>
				<td>${escapeHtml(formatDate(r.inspection_date))}</td>
				<td>${escapeHtml(r.decision || '-')}</td>
				<td>${escapeHtml(r.operator_name || '-')}</td>
			</tr>
		`).join('');
		const piItems = record.items || [];
		const piN = piItems.length;
		const piKabul = piItems.filter((r) => {
			const d = String(r.decision || '');
			return d.includes('Kabul') && !d.includes('Şart');
		}).length;
		const piSartli = piItems.filter((r) => String(r.decision || '').includes('Şart')).length;
		const piRet = piItems.filter((r) => String(r.decision || '').includes('Ret')).length;
		const piOther = Math.max(0, piN - piKabul - piSartli - piRet);
		const piKabulRate = piN > 0 ? ((piKabul / piN) * 100).toFixed(1) : '0';
		const piRetRate = piN > 0 ? ((piRet / piN) * 100).toFixed(1) : '0';
		summaryHtml = `
			<p><strong>Toplam muayene:</strong> ${totalCount}</p>
			<p><strong>Kabul:</strong> ${piKabul} (${piKabulRate}%) · <strong>Şartlı kabul:</strong> ${piSartli} · <strong>Ret:</strong> ${piRet} (${piRetRate}%)</p>
			${piOther > 0 ? `<p><strong>Diğer karar:</strong> ${piOther}</p>` : ''}
			${record.filterInfo ? `<p><strong>Filtre:</strong> ${escapeHtml(record.filterInfo)}</p>` : ''}
		`;
	} else if (type === 'fixture_list') {
		title = record.title || 'Fikstür Liste Raporu';
		headers = ['Görsel', 'Fikstür No', 'Parça Bilgisi', 'Bölüm', 'Sınıf', 'Durum', 'Son Doğrulama', 'Sonraki Doğrulama'];
		rowsHtml = (record.items || []).map(item => {
			const imageUrl = getFixtureImageUrl(item.image_paths);
			const criticalityBadge = item.criticality_class === 'Kritik'
				? '<span style="padding: 4px 8px; border-radius: 999px; font-size: 0.75em; font-weight: 700; background-color: #ffedd5; color: #c2410c; white-space: nowrap;">Kritik</span>'
				: '<span style="padding: 4px 8px; border-radius: 999px; font-size: 0.75em; font-weight: 700; background-color: #e2e8f0; color: #334155; white-space: nowrap;">Standart</span>';

			const statusBadge = item.status === 'Aktif'
				? '<span style="padding: 4px 8px; border-radius: 999px; font-size: 0.75em; font-weight: 700; background-color: #dcfce7; color: #166534; white-space: nowrap;">Aktif</span>'
				: item.status === 'Devreye Alma Bekleniyor'
					? '<span style="padding: 4px 8px; border-radius: 999px; font-size: 0.75em; font-weight: 700; background-color: #dbeafe; color: #1d4ed8; white-space: nowrap;">Devreye Alma Bekleniyor</span>'
					: item.status === 'Uygunsuz'
						? '<span style="padding: 4px 8px; border-radius: 999px; font-size: 0.75em; font-weight: 700; background-color: #fee2e2; color: #991b1b; white-space: nowrap;">Uygunsuz</span>'
						: item.status === 'Revizyon Beklemede'
							? '<span style="padding: 4px 8px; border-radius: 999px; font-size: 0.75em; font-weight: 700; background-color: #f3e8ff; color: #7e22ce; white-space: nowrap;">Revizyon Beklemede</span>'
							: item.status === 'Hurdaya Ayrılmış'
								? '<span style="padding: 4px 8px; border-radius: 999px; font-size: 0.75em; font-weight: 700; background-color: #e5e7eb; color: #374151; white-space: nowrap;">Hurdaya Ayrılmış</span>'
								: `<span style="padding: 4px 8px; border-radius: 999px; font-size: 0.75em; font-weight: 700; background-color: #e5e7eb; color: #374151; white-space: nowrap;">${escapeHtml(item.status || '-')}</span>`;

			return `
				<tr>
					<td style="width: 12%; text-align: center; vertical-align: middle;">
						${imageUrl
							? `<img src="${imageUrl}" alt="${escapeHtml(item.fixture_no)} görseli" class="fixture-thumb" />`
							: '<div class="fixture-thumb fixture-thumb-placeholder">Görsel Yok</div>'}
					</td>
					<td style="width: 10%; vertical-align: middle;">
						<div style="font-weight: 700; font-size: 1.05em; color: #0f172a;">${escapeHtml(item.fixture_no || '-')}</div>
					</td>
					<td style="width: 24%; vertical-align: middle;">
						<div style="font-weight: 700; color: #1f2937;">${escapeHtml(item.part_code || '-')}</div>
						<div style="margin-top: 4px; color: #475569; line-height: 1.35;">${escapeHtml(item.part_name || '-')}</div>
					</td>
					<td style="width: 13%; vertical-align: middle;">${escapeHtml(item.responsible_department || '-')}</td>
					<td style="width: 8%; text-align: center; vertical-align: middle;">${criticalityBadge}</td>
					<td style="width: 13%; vertical-align: middle;">${statusBadge}</td>
					<td style="width: 10%; white-space: nowrap; vertical-align: middle;">${formatDate(item.last_verification_date)}</td>
					<td style="width: 10%; white-space: nowrap; vertical-align: middle;">${formatDate(item.next_verification_date)}</td>
				</tr>
			`;
		}).join('');

		const statusCounts = record.statusCounts || (record.items || []).reduce((acc, item) => {
			acc[item.status || 'Bilinmiyor'] = (acc[item.status || 'Bilinmiyor'] || 0) + 1;
			return acc;
		}, {});
		const statusSummary = Object.entries(statusCounts)
			.map(([status, count]) => `<span style="margin-right: 15px;"><strong>${escapeHtml(status)}:</strong> ${count}</span>`)
			.join('');

		const criticalityCounts = record.criticalityCounts || (record.items || []).reduce((acc, item) => {
			acc[item.criticality_class || 'Bilinmiyor'] = (acc[item.criticality_class || 'Bilinmiyor'] || 0) + 1;
			return acc;
		}, {});
		const criticalitySummary = Object.entries(criticalityCounts)
			.map(([level, count]) => `<span style="margin-right: 15px;"><strong>${escapeHtml(level)}:</strong> ${count}</span>`)
			.join('');

		summaryHtml = `
			<p><strong>Toplam Fikstür Sayısı:</strong> ${totalCount}</p>
			${record.filterInfo ? `<p><strong>Filtre:</strong> ${escapeHtml(record.filterInfo)}</p>` : ''}
			${statusSummary ? `<p><strong>Durum Dağılımı:</strong> ${statusSummary}</p>` : ''}
			${criticalitySummary ? `<p><strong>Sınıf Dağılımı:</strong> ${criticalitySummary}</p>` : ''}
		`;
	} else if (type === 'document_list') {
		title = record.categoryName || 'Doküman Listesi Raporu';
		headers = ['Doküman Adı / Numarası', 'Birim', 'Versiyon', 'Yayın Tarihi', 'Revizyon Tarihi', 'Geçerlilik Durumu'];
		rowsHtml = record.items.map(item => {
			const validUntil = item.valid_until ? formatDate(item.valid_until) : 'Süresiz';
			const validUntilDate = item.valid_until ? new Date(item.valid_until) : null;
			const now = new Date();
			let statusBadge = '';
			if (!validUntilDate) {
				statusBadge = '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #e5e7eb; color: #374151;">Süresiz</span>';
			} else {
				const diffDays = Math.ceil((validUntilDate - now) / (1000 * 60 * 60 * 24));
				if (diffDays < 0) {
					statusBadge = `<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #fee2e2; color: #991b1b;">Süresi Doldu</span>`;
				} else if (diffDays <= 30) {
					statusBadge = `<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #fef3c7; color: #92400e;">${diffDays} gün kaldı</span>`;
				} else {
					statusBadge = `<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #d1fae5; color: #065f46;">${diffDays} gün kaldı</span>`;
				}
			}
			return `
				<tr>
					<td style="width: 30%;"><strong>${item.title || '-'}</strong><br><small class="muted" style="font-size: 0.75em;">${item.document_number || '-'}</small></td>
					<td style="width: 15%;">${item.department_name || '-'}</td>
					<td style="width: 10%; text-align: center;">${item.revision_number || '1'}</td>
					<td style="width: 12%; white-space: nowrap;">${formatDate(item.publish_date)}</td>
					<td style="width: 12%; white-space: nowrap;">${formatDate(item.revision_date)}</td>
					<td style="width: 21%;">${statusBadge}</td>
				</tr>
			`;
		}).join('');

		summaryHtml = `
			<p><strong>Toplam Doküman Sayısı:</strong> ${totalCount}</p>
			<p><strong>Kategori:</strong> ${record.categoryName || '-'}</p>
		`;
	} else if (type === 'deviation_list') {
		title = record.title || 'Sapma Yönetimi Liste Raporu';
		headers = ['Talep No', 'Durum', 'Talep Eden', 'Birim', 'Kaynak', 'Ürün / Parça', 'Parça adedi (araç)', 'Talep Tarihi', 'Geçerlilik', 'Açıklama'];
		rowsHtml = (record.items || []).map(item => {
			const statusBadge = item.status === 'Onaylandı'
				? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #d1fae5; color: #065f46;">Onaylandı</span>'
				: item.status === 'Reddedildi'
					? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #fee2e2; color: #991b1b;">Reddedildi</span>'
					: item.status === 'Onay Bekliyor'
						? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #fef3c7; color: #92400e;">Onay Bekliyor</span>'
						: '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #dbeafe; color: #1d4ed8;">Açık</span>';

			return `
				<tr>
					<td style="white-space: nowrap; font-weight: 600;">${item.request_no || '-'}</td>
					<td>${statusBadge}</td>
					<td>${item.requesting_person || '-'}</td>
					<td>${item.requesting_unit || '-'}</td>
					<td>${item.source || '-'}</td>
					<td>${item.product_part || '-'}</td>
					<td style="font-size: 0.85em; max-width: 140px;">${item.part_qty_per_vehicle_summary != null && item.part_qty_per_vehicle_summary !== '' ? item.part_qty_per_vehicle_summary : '-'}</td>
					<td style="white-space: nowrap;">${item.created_at || '-'}</td>
					<td style="white-space: nowrap;">${item.valid_until || '-'}</td>
					<td style="font-size: 0.85em;">${item.description || '-'}</td>
				</tr>
			`;
		}).join('');

		const statusCounts = record.statusCounts || {};
		const statusSummary = Object.entries(statusCounts)
			.map(([status, count]) => `<span style="margin-right: 15px;"><strong>${status}:</strong> ${count}</span>`)
			.join('');
		const sourceCounts = record.sourceCounts || {};
		const sourceSummary = Object.entries(sourceCounts)
			.map(([source, count]) => `<span style="margin-right: 15px;"><strong>${source}:</strong> ${count}</span>`)
			.join('');

		summaryHtml = `
			<p><strong>Toplam Sapma Talebi:</strong> ${totalCount}</p>
			${statusSummary ? `<p><strong>Durum Dağılımı:</strong> ${statusSummary}</p>` : ''}
			${sourceSummary ? `<p><strong>Kaynak Dağılımı:</strong> ${sourceSummary}</p>` : ''}
		`;
	} else if (type === 'nonconformity_record_list') {
		title = record.title || 'Uygunsuzluk Yönetimi Liste Raporu';
		headers = ['Kayıt No', 'Parça Kodu', 'Parça Adı', 'Kategori', 'Ciddiyet', 'Adet', 'Tespit Tarihi', 'Durum', 'Sorumlu'];
		const escapeHtml = (value) => String(value ?? '-')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
		rowsHtml = (record.items || []).map(item => {
			const severityBadge = item.severity === 'Kritik'
				? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #fee2e2; color: #991b1b;">Kritik</span>'
				: item.severity === 'Yüksek'
					? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #ffedd5; color: #c2410c;">Yüksek</span>'
					: item.severity === 'Orta'
						? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #fef3c7; color: #92400e;">Orta</span>'
						: '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #dcfce7; color: #166534;">Düşük</span>';

			const statusBadge = item.status === 'Kapatıldı'
				? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #e5e7eb; color: #374151;">Kapatıldı</span>'
				: item.status === 'DF Açıldı'
					? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #dbeafe; color: #1d4ed8;">DF Açıldı</span>'
					: item.status === '8D Açıldı'
						? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #ede9fe; color: #6d28d9;">8D Açıldı</span>'
						: item.status === '8D Önerildi'
							? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #f3e8ff; color: #7e22ce;">8D Önerildi</span>'
							: item.status === 'DF Önerildi'
								? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #e0f2fe; color: #0369a1;">DF Önerildi</span>'
								: '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #dbeafe; color: #1d4ed8;">Açık</span>';

			return `
				<tr>
					<td style="white-space: nowrap; font-weight: 600;">${item.record_number || '-'}</td>
					<td>${item.part_code || '-'}</td>
					<td>${item.part_name || '-'}</td>
					<td>${item.category || '-'}</td>
					<td>${severityBadge}</td>
					<td style="text-align: center;">${item.quantity || 0}</td>
					<td style="white-space: nowrap;">${item.detection_date || '-'}</td>
					<td>${statusBadge}</td>
					<td>${item.responsible_person || '-'}</td>
				</tr>
			`;
		}).join('');

		const statusCounts = record.statusCounts || {};
		const statusSummary = Object.entries(statusCounts)
			.map(([status, count]) => `<span style="margin-right: 15px;"><strong>${status}:</strong> ${count}</span>`)
			.join('');
		const severityCounts = record.severityCounts || {};
		const severitySummary = Object.entries(severityCounts)
			.map(([severity, count]) => `<span style="margin-right: 15px;"><strong>${severity}:</strong> ${count}</span>`)
			.join('');
		const personnelPerformanceRows = (record.personnelPerformance || []).map(person => `
			<tr>
				<td>${escapeHtml(person.name)}</td>
				<td style="text-align: center;">${person.total || 0}</td>
				<td style="text-align: center;">${person.closed || 0}</td>
				<td style="text-align: center;">${person.open || 0}</td>
				<td style="text-align: center;">${person.critical || 0}</td>
				<td style="text-align: center;">${person.quantity || 0}</td>
				<td style="text-align: center;">%${person.closeRate || 0}</td>
			</tr>
		`).join('');

		summaryHtml = `
			<p><strong>Toplam Uygunsuzluk Kaydı:</strong> ${totalCount}</p>
			${statusSummary ? `<p><strong>Durum Dağılımı:</strong> ${statusSummary}</p>` : ''}
			${severitySummary ? `<p><strong>Ciddiyet Dağılımı:</strong> ${severitySummary}</p>` : ''}
			${personnelPerformanceRows ? `
				<div style="margin-top: 16px;">
					<p><strong>Personel Performansı (Sorumlu Kişi Bazında):</strong></p>
					<table class="info-table" style="margin-top: 8px;">
						<thead>
							<tr>
								<th>Personel</th>
								<th>Toplam</th>
								<th>Kapatılan</th>
								<th>Açık</th>
								<th>Kritik</th>
								<th>Toplam Adet</th>
								<th>Kapanış Oranı</th>
							</tr>
						</thead>
						<tbody>
							${personnelPerformanceRows}
						</tbody>
					</table>
				</div>
			` : ''}
		`;
	} else if (type === 'nonconformity_list') {
		title = 'Uygunsuzluk (DF/8D) Listesi Raporu';
		headers = ['No', 'Tip', 'Problem', 'Departman', 'Açılış Tarihi', 'Kapanış Tarihi', 'Termin Tarihi', 'Durum', 'Sorumlu Kişi'];
		rowsHtml = record.items.map(item => {
			const statusBadge = item.status === 'Kapatıldı'
				? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #d1fae5; color: #065f46;">Kapatıldı</span>'
				: item.status === 'Reddedildi'
					? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #fee2e2; color: #991b1b;">Reddedildi</span>'
					: item.status === 'Gecikmiş'
						? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #fee2e2; color: #991b1b;">Gecikmiş</span>'
						: item.status === 'İşlemde'
							? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #fef3c7; color: #92400e;">İşlemde</span>'
							: item.status === 'Onay Bekliyor'
								? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #dbeafe; color: #1e40af;">Onay Bekliyor</span>'
								: '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #e5e7eb; color: #374151;">Açık</span>';

			const typeBadge = item.type === 'DF'
				? '<span style="padding: 2px 6px; border-radius: 4px; font-size: 0.7em; font-weight: 600; background-color: #3b82f6; color: white;">DF</span>'
				: item.type === '8D'
					? '<span style="padding: 2px 6px; border-radius: 4px; font-size: 0.7em; font-weight: 600; background-color: #9333ea; color: white;">8D</span>'
					: item.type === 'MDI'
						? '<span style="padding: 2px 6px; border-radius: 4px; font-size: 0.7em; font-weight: 600; background-color: #4f46e5; color: white;">MDI</span>'
						: item.type;

			return `
				<tr>
					<td style="width: 10%; white-space: nowrap; font-weight: 600;">${item.nc_number}</td>
					<td style="width: 6%; text-align: center;">${typeBadge}</td>
					<td style="width: 20%;"><strong>${item.title}</strong></td>
					<td style="width: 12%;">${item.department}</td>
					<td style="width: 10%; white-space: nowrap;">${item.opening_date}</td>
					<td style="width: 10%; white-space: nowrap;">${item.closing_date}</td>
					<td style="width: 10%; white-space: nowrap;">${item.due_date}</td>
					<td style="width: 12%;">${statusBadge}</td>
					<td style="width: 10%; font-size: 0.85em;">${item.responsible_person}</td>
				</tr>
			`;
		}).join('');

		// Durum bazlı özet
		const statusCounts = record.items.reduce((acc, item) => {
			acc[item.status] = (acc[item.status] || 0) + 1;
			return acc;
		}, {});
		const statusSummary = Object.entries(statusCounts)
			.map(([status, count]) => `<span style="margin-right: 15px;"><strong>${status}:</strong> ${count}</span>`)
			.join('');

		// Tip bazlı özet
		const typeCounts = record.items.reduce((acc, item) => {
			acc[item.type] = (acc[item.type] || 0) + 1;
			return acc;
		}, {});
		const typeSummary = Object.entries(typeCounts)
			.map(([type, count]) => `<span style="margin-right: 15px;"><strong>${type}:</strong> ${count}</span>`)
			.join('');

		summaryHtml = `
			<p><strong>Toplam Kayıt Sayısı:</strong> ${totalCount}</p>
			${record.departmentSelectionLabel ? `<p><strong>Seçilen Birimler:</strong> ${record.departmentSelectionLabel}</p>` : ''}
			<p><strong>Durum Dağılımı:</strong> ${statusSummary}</p>
			<p><strong>Tip Dağılımı:</strong> ${typeSummary}</p>
		`;
	} else if (type === 'quality_cost_list') {
		title = record.unit ? `${record.unit} Birimi-Kalite Maliyetleri Raporu` : 'Kalite Maliyetleri Raporu';
		headers = ['Tarih', 'Maliyet Türü', 'Parça', 'Araç Tipi', 'Miktar', 'Tutar', 'Açıklama', 'Birim/Müşteri', 'Raporlayan'];

		rowsHtml = record.items.map(item => {
			const amountFormatted = typeof item.amount === 'number'
				? item.amount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
				: '-';

			const quantityText = item.quantity && item.quantity !== '-'
				? `${item.quantity} ${item.measurement_unit || ''}`.trim()
				: '-';

			const supplierBadge = item.is_supplier_nc && item.supplier_name && item.supplier_name !== '-'
				? `<span style="padding: 2px 6px; border-radius: 4px; font-size: 0.7em; font-weight: 600; background-color: #fef3c7; color: #92400e;">${item.supplier_name}</span>`
				: '';

			const descSafe = (item.description || '-').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
			const partInfo = [item.part_code, item.part_name].filter(v => v && v !== '-').join(' - ') || '-';

			// Müşteri ve birim bilgisi (Dış Hata'da her ikisi de)
			let unitOrCustomer = item.unit || '-';
			if (item.cost_type === 'Dış Hata Maliyeti' && item.customer_name) {
				const unitPart = (item.supplier_name && item.supplier_name !== '-') ? item.supplier_name : item.unit;
				unitOrCustomer = `<span style="color: #2563eb; font-weight: 600;">Müşteri: ${item.customer_name}</span>${unitPart ? `<br><span style="color: #92400e; font-weight: 600;">${unitPart}</span>` : ''}`;
			}

			// Birim dağılımı satır altı
			let allocationRowHtml = '';
			if (item.is_allocated && item.cost_allocations?.length) {
				const allocCells = item.cost_allocations.map(a => {
					const amt = a.amount ?? (item.total_amount || 0) * (parseFloat(a.percentage) || 0) / 100;
					const amtStr = (typeof amt === 'number' ? amt : 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
					return `<span style="display:inline-block; margin:2px 4px; padding:3px 8px; border-radius:4px; background:#eef2ff; border:1px solid #c7d2fe; font-size:0.8em; color:#3730a3;"><strong>${a.unit}</strong> %${parseFloat(a.percentage).toFixed(0)} = ${amtStr}</span>`;
				}).join('');
				allocationRowHtml = `
				<tr style="background-color:#f8fafc; border-top:none;">
					<td colspan="9" style="padding:4px 12px 8px; border-top:none;">
						<span style="font-size:0.75em; font-weight:600; color:#6366f1; text-transform:uppercase; letter-spacing:0.5px; margin-right:8px;">Birim Dağılımı:</span>${allocCells}
					</td>
				</tr>`;
			}

			return `
				<tr>
					<td style="width: 7%; white-space: nowrap;">${item.cost_date}</td>
					<td style="width: 12%;"><strong>${item.cost_type}</strong>${supplierBadge ? '<br>' + supplierBadge : ''}</td>
					<td style="width: 12%;">${partInfo}</td>
					<td style="width: 8%; font-size: 0.85em;">${item.vehicle_type}</td>
					<td style="width: 6%; text-align: center; white-space: nowrap;">${quantityText}</td>
					<td style="width: 9%; text-align: right; font-weight: 600; color: #dc2626;">${amountFormatted}</td>
					<td style="width: 26%; font-size: 0.85em;"><div style="white-space: pre-wrap; word-wrap: break-word; margin: 0; font-family: inherit; line-height: 1.3;">${descSafe}</div></td>
					<td style="width: 8%; font-size: 0.85em;">${unitOrCustomer}</td>
					<td style="width: 8%; font-size: 0.85em;">${item.reporting_unit || '-'}</td>
				</tr>
				${allocationRowHtml}
			`;
		}).join('');

		// Maliyet türü bazlı özet
		const typeSummary = record.costsByType && record.costsByType.length > 0
			? record.costsByType.map(typeData => {
				const typeAmountFormatted = typeData.totalAmount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
				return `<span style="margin-right: 15px;"><strong>${typeData.type}:</strong> ${typeAmountFormatted} (${typeData.count} kayıt, %${typeData.percentage.toFixed(1)})</span>`;
			}).join('')
			: '';

		const totalAmountFormatted = record.totalAmount
			? record.totalAmount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
			: '0,00 ₺';

		const periodInfo = record.periodStart && record.periodEnd
			? `${record.periodStart}-${record.periodEnd}`
			: record.period || 'Tüm Zamanlar';

		summaryHtml = `
			<p><strong>Birim:</strong> ${record.unit || 'Belirtilmemiş'}</p>
			<p><strong>Dönem:</strong> ${periodInfo}</p>
			<p><strong>Toplam Kayıt Sayısı:</strong> ${totalCount}</p>
			<p><strong>Toplam Maliyet:</strong> <span style="font-size: 1.2em; font-weight: 700; color: #dc2626;">${totalAmountFormatted}</span></p>
			${typeSummary ? `<p><strong>Maliyet Türü Dağılımı:</strong><br>${typeSummary}</p>` : ''}
		`;
	} else if (type === 'quality_cost_detail') {
		// Tek kayıt için detaylı rapor
		title = 'Kalite Maliyeti Detay Raporu';
		const formatCurrencyLocal = (value) => (value || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
		const formatDateLocal = (dateStr) => formatDateHelper(dateStr, 'dd.MM.yyyy');

		// Fatura kalemleri toplamları
		const lineItems = record.cost_line_items && Array.isArray(record.cost_line_items) ? record.cost_line_items : [];
		const sharedCostItems = record.shared_costs && Array.isArray(record.shared_costs) ? record.shared_costs : [];
		const indirectCostItems = record.indirect_costs && Array.isArray(record.indirect_costs) ? record.indirect_costs : [];
		const hasLineItems = lineItems.length > 0;
		const lineItemsTotal = lineItems.reduce((s, li) => s + (parseFloat(li.amount) || 0), 0);
		const sharedCostsTotal = sharedCostItems.reduce((s, sc) => s + (parseFloat(sc.amount) || 0), 0);
		const indirectCostsTotal = indirectCostItems.reduce((s, ic) => s + (parseFloat(ic.amount) || 0), 0);

		// Birim bazlı toplamlar - payı olan TÜM birimler (cost_allocations + line items)
		const unitTotalsMap = {};
		if (hasLineItems && lineItemsTotal > 0) {
			lineItems.forEach(li => {
				const liAmt = parseFloat(li.amount) || 0;
				const pct = (liAmt / lineItemsTotal) * 100;
				const sharedShare = sharedCostsTotal * (pct / 100);
				const totalForItem = liAmt + sharedShare;
				const unitKey = li.responsible_type === 'supplier'
					? `Tedarikçi: ${li.responsible_supplier_name || record.supplier?.name || 'Belirtilmemiş'}`
					: (li.responsible_unit || 'Belirtilmemiş');
				unitTotalsMap[unitKey] = (unitTotalsMap[unitKey] || 0) + totalForItem;
			});
		} else if (record.cost_allocations && record.cost_allocations.length > 0) {
			const totalAmt = record.amount || 0;
			record.cost_allocations.forEach(a => {
				const amt = a.amount ?? totalAmt * (parseFloat(a.percentage) || 0) / 100;
				const unitKey = a.unit || 'Belirtilmemiş';
				unitTotalsMap[unitKey] = (unitTotalsMap[unitKey] || 0) + amt;
			});
		} else if (record.unit) {
			unitTotalsMap[record.unit] = record.amount || 0;
		}
		const unitTotalsList = Object.entries(unitTotalsMap)
			.map(([unit, amt]) => ({ unit, amount: amt }))
			.sort((a, b) => b.amount - a.amount);
		const grandTotal = hasLineItems
			? (lineItemsTotal + sharedCostsTotal + indirectCostsTotal)
			: (record.amount || 0);
		const unitSummaryHtml = unitTotalsList.length > 0 ? `
			<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px;">
				<h3 style="font-size: 14px; font-weight: 700; color: #1e40af; margin-bottom: 12px; border-bottom: 2px solid #3b82f6; padding-bottom: 6px;">Birim Bazlı Toplam Maliyetler (Payı Olan Tüm Birimler)</h3>
				<div style="display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 12px;">
					${unitTotalsList.map(u => `<span style="background: white; padding: 8px 14px; border-radius: 6px; border-left: 4px solid #2563eb; font-size: 13px;"><strong>${u.unit}:</strong> ${formatCurrencyLocal(u.amount)}</span>`).join('')}
				</div>
				<div style="padding-top: 12px; border-top: 1px solid #e2e8f0; display: flex; flex-wrap: wrap; gap: 16px; font-size: 13px;">
					${hasLineItems ? `<span><strong>Kalem Toplamı:</strong> ${formatCurrencyLocal(lineItemsTotal)}</span>` : ''}
					${sharedCostItems.length > 0 ? `<span><strong>Ortak Pay Toplamı:</strong> ${formatCurrencyLocal(sharedCostsTotal)}</span>` : ''}
					<span><strong>Maliyet Toplamı:</strong> ${formatCurrencyLocal(grandTotal)}</span>
				</div>
			</div>
		` : (record.unit ? `
			<div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
				<div><strong>Birim:</strong> ${record.unit}</div>
				<div style="font-size: 1.3em; font-weight: 700;">${formatCurrencyLocal(record.amount)}</div>
			</div>
		` : '');

		// Ana bilgiler kartı - profesyonel şerit stili (renkli sol kenar)
		const mainInfoHtml = `
			${unitSummaryHtml}
			<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px;">
				<div style="background-color: #ffffff; border-radius: 8px; padding: 20px; text-align: left; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border: 1px solid #e5e7eb; border-left: 5px solid #2563eb;">
					<div style="font-size: 10px; margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">Toplam Tutar</div>
					<div style="font-size: 22px; font-weight: 700; margin-bottom: 6px; color: #1f2937;">${formatCurrencyLocal(record.amount)}</div>
					${hasLineItems ? `<div style="font-size: 11px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 8px;">${lineItems.length} kalem${sharedCostItems.length > 0 ? ` + ${sharedCostItems.length} ortak` : ''}${indirectCostItems.length > 0 ? ` + ${indirectCostItems.length} dolaylı` : ''}</div>` : ''}
				</div>
				<div style="background-color: #ffffff; border-radius: 8px; padding: 20px; text-align: left; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border: 1px solid #e5e7eb; border-left: 5px solid #dc2626;">
					<div style="font-size: 10px; margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">Maliyet Türü</div>
					<div style="font-size: 16px; font-weight: 700; margin-bottom: 6px; color: #1f2937;">${record.cost_type || '-'}</div>
				</div>
				<div style="background-color: #ffffff; border-radius: 8px; padding: 20px; text-align: left; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border: 1px solid #e5e7eb; border-left: 5px solid #059669;">
					<div style="font-size: 10px; margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">Tarih</div>
					<div style="font-size: 16px; font-weight: 700; margin-bottom: 6px; color: #1f2937;">${formatDateLocal(record.cost_date)}</div>
					${record.invoice_number ? `<div style="font-size: 11px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 8px;">Fatura: ${record.invoice_number}</div>` : ''}
				</div>
			</div>
		`;

		// === FATURA KALEMLERİ BÖLÜMÜ ===
		let lineItemsSectionHtml = '';
		if (hasLineItems) {
			const lineItemRowsHtml = lineItems.map((li, idx) => {
				const liAmount = parseFloat(li.amount) || 0;
				const responsible = li.responsible_type === 'supplier' 
					? `<span style="padding:2px 6px; border-radius:4px; font-size:0.8em; font-weight:600; background-color:#fef3c7; color:#92400e;">${li.responsible_supplier_name || li.responsible_unit || '-'}</span>`
					: (li.responsible_unit || '-');
				return `
					<tr>
						<td style="padding:10px 14px; font-weight:600;">${idx + 1}</td>
						<td style="padding:10px 14px;">${li.part_code || '-'}</td>
						<td style="padding:10px 14px;">${li.part_name || '-'}</td>
						<td style="padding:10px 14px;">${li.cost_subtype || '-'}</td>
						<td style="padding:10px 14px;">${responsible}</td>
						<td style="padding:10px 14px; text-align:center;">${li.quantity || '-'} ${li.measurement_unit || ''}</td>
						<td style="padding:10px 14px; text-align:right; font-weight:700; color:#dc2626;">${formatCurrencyLocal(liAmount)}</td>
					</tr>
					${li.description ? `<tr style="background-color:#f8fafc;"><td colspan="7" style="padding:4px 14px 8px; font-size:0.85em; color:#64748b; border-top:none;"><em>${String(li.description).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</em></td></tr>` : ''}`;
			}).join('');

			lineItemsSectionHtml = `
				<div class="section">
					<h2 class="section-title section-title-strip blue">MALİYET KALEMLERİ (FATURA DETAYI)</h2>
					<table style="width:100%; border-collapse:collapse; margin-top:10px; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
						<thead>
							<tr style="background:#f8fafc; border-bottom:2px solid #2563eb;">
								<th style="text-align:left; padding:12px 14px; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; width:30px; color:#1f2937;">#</th>
								<th style="text-align:left; padding:12px 14px; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; color:#1f2937;">Parça Kodu</th>
								<th style="text-align:left; padding:12px 14px; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; color:#1f2937;">Parça Adı</th>
								<th style="text-align:left; padding:12px 14px; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; color:#1f2937;">Alt Tür</th>
								<th style="text-align:left; padding:12px 14px; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; color:#1f2937;">Sorumlu</th>
								<th style="text-align:center; padding:12px 14px; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; color:#1f2937;">Miktar</th>
								<th style="text-align:right; padding:12px 14px; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; color:#1f2937;">Tutar</th>
							</tr>
						</thead>
						<tbody>
							${lineItemRowsHtml}
							<tr style="background:#f8fafc; border-top:2px solid #e5e7eb;">
								<td colspan="6" style="font-weight:700; padding:12px 14px; font-size:12px;">KALEMLER TOPLAMI</td>
								<td style="text-align:right; font-weight:700; color:#dc2626; padding:12px 14px; font-size:14px;">${formatCurrencyLocal(lineItemsTotal)}</td>
							</tr>
						</tbody>
					</table>
				</div>
			`;
		}

		// === ORTAK MALİYETLER BÖLÜMÜ (Nakliye, Konaklama vb.) ===
		let sharedCostsSectionHtml = '';
		if (sharedCostItems.length > 0) {
			const sharedRowsHtml = sharedCostItems.map(sc => {
				return `
					<tr>
						<td style="padding:10px 14px; font-weight:600;">${sc.category || '-'}</td>
						<td style="padding:10px 14px;">${sc.description || '-'}</td>
						<td style="padding:10px 14px; text-align:center;">${sc.measurement_value || '-'} ${sc.measurement_unit || ''}</td>
						<td style="padding:10px 14px; text-align:right; font-weight:700; color:#d97706;">${formatCurrencyLocal(parseFloat(sc.amount) || 0)}</td>
					</tr>`;
			}).join('');

			// Nakliye dağılımı hesapla
			let distributionHtml = '';
			if (hasLineItems && lineItemsTotal > 0) {
				const distRows = lineItems.map(li => {
					const liAmt = parseFloat(li.amount) || 0;
					const pct = lineItemsTotal > 0 ? (liAmt / lineItemsTotal) * 100 : 0;
					const sharedShare = sharedCostsTotal * (pct / 100);
					const itemLabel = li.part_code || li.part_name || '-';
					const subtypeLabel = li.cost_subtype || '-';
					return `
						<tr>
							<td style="padding:8px 14px;">${itemLabel}</td>
							<td style="padding:8px 14px; font-weight:600; color:#92400e;">${subtypeLabel}</td>
							<td style="padding:8px 14px;">${li.responsible_unit || li.responsible_supplier_name || '-'}</td>
							<td style="padding:8px 14px; text-align:center;">
								<div style="display:flex; align-items:center; gap:6px; justify-content:center;">
									<div style="flex:1; max-width:80px; height:6px; background:#e5e7eb; border-radius:3px; overflow:hidden;">
										<div style="width:${pct}%; height:100%; background:#f59e0b; border-radius:3px;"></div>
									</div>
									<span style="font-weight:600; color:#d97706; font-size:0.9em;">%${pct.toFixed(1)}</span>
								</div>
							</td>
							<td style="padding:8px 14px; text-align:right; font-weight:600;">${formatCurrencyLocal(sharedShare)}</td>
							<td style="padding:8px 14px; text-align:right; font-weight:700; color:#1e40af;">${formatCurrencyLocal(liAmt + sharedShare)}</td>
						</tr>`;
				}).join('');
				distributionHtml = `
					<div style="margin-top:15px; padding:15px; background:#fffbeb; border:1px solid #fde68a; border-radius:8px;">
						<div style="font-weight:700; color:#92400e; font-size:12px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px;">Ortak Maliyet Dağılımı (Kalemlere Göre)</div>
						<table style="width:100%; border-collapse:collapse; font-size:0.9em;">
							<thead><tr style="border-bottom:1px solid #fde68a; color:#92400e;">
								<th style="text-align:left; padding:6px 14px; font-size:10px; text-transform:uppercase;">Kalem</th>
								<th style="text-align:left; padding:6px 14px; font-size:10px; text-transform:uppercase;">Tür</th>
								<th style="text-align:left; padding:6px 14px; font-size:10px; text-transform:uppercase;">Sorumlu</th>
								<th style="text-align:center; padding:6px 14px; font-size:10px; text-transform:uppercase;">Pay</th>
								<th style="text-align:right; padding:6px 14px; font-size:10px; text-transform:uppercase;">Ortak Pay</th>
								<th style="text-align:right; padding:6px 14px; font-size:10px; text-transform:uppercase;">Toplam</th>
							</tr></thead>
							<tbody>${distRows}</tbody>
						</table>
					</div>`;
			}

			sharedCostsSectionHtml = `
				<div class="section">
					<h2 class="section-title section-title-strip amber">ORTAK MALİYETLER (NAKLİYE / KONAKLAMA / YOL)</h2>
					<table style="width:100%; border-collapse:collapse; margin-top:10px; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
						<thead>
							<tr style="background:#fffbeb; border-bottom:2px solid #d97706;">
								<th style="text-align:left; padding:12px 14px; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; color:#1f2937;">Kategori</th>
								<th style="text-align:left; padding:12px 14px; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; color:#1f2937;">Açıklama</th>
								<th style="text-align:center; padding:12px 14px; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; color:#1f2937;">Ölçü</th>
								<th style="text-align:right; padding:12px 14px; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; color:#1f2937;">Tutar</th>
							</tr>
						</thead>
						<tbody>
							${sharedRowsHtml}
							<tr style="background:#fffbeb; border-top:2px solid #fde68a;">
								<td colspan="3" style="font-weight:700; padding:10px 14px;">ORTAK MALİYET TOPLAMI</td>
								<td style="text-align:right; font-weight:700; color:#d97706; padding:10px 14px; font-size:1.1em;">${formatCurrencyLocal(sharedCostsTotal)}</td>
							</tr>
						</tbody>
					</table>
					${hasLineItems ? `
					<div style="margin-top:12px; padding:12px; background:#f0fdf4; border:1px solid #86efac; border-radius:6px; font-size:0.9em;">
						<strong>Özet:</strong> Kalem Toplamı: ${formatCurrencyLocal(lineItemsTotal)} | Ortak Pay Toplamı: ${formatCurrencyLocal(sharedCostsTotal)} | Toplam: ${formatCurrencyLocal(lineItemsTotal + sharedCostsTotal)}
					</div>
					` : ''}
					${distributionHtml}
				</div>
			`;
		}

		// === DOLAYLI MALİYETLER BÖLÜMÜ ===
		let indirectCostsSectionHtml = '';
		if (indirectCostItems.length > 0) {
			const indirectRowsHtml = indirectCostItems.map(ic => {
				const descSafe = ic.description ? String(ic.description).replace(/</g, '&lt;').replace(/>/g, '&gt;') : '-';
				return `
					<tr>
						<td style="padding:10px 14px; font-weight:600;">${ic.category || '-'}</td>
						<td style="padding:10px 14px;">${descSafe}</td>
						<td style="padding:10px 14px; text-align:right; font-weight:700; color:#dc2626;">${formatCurrencyLocal(parseFloat(ic.amount) || 0)}</td>
					</tr>`;
			}).join('');

			indirectCostsSectionHtml = `
				<div class="section">
					<h2 class="section-title section-title-strip" style="border-left-color:#7c3aed;">DOLAYLI MALİYETLER</h2>
					<table style="width:100%; border-collapse:collapse; margin-top:10px; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
						<thead>
							<tr style="background:#f5f3ff; border-bottom:2px solid #7c3aed;">
								<th style="text-align:left; padding:12px 14px; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; color:#1f2937;">Kategori</th>
								<th style="text-align:left; padding:12px 14px; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; color:#1f2937;">Açıklama</th>
								<th style="text-align:right; padding:12px 14px; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; color:#1f2937;">Tutar</th>
							</tr>
						</thead>
						<tbody>
							${indirectRowsHtml}
							<tr style="background:#f5f3ff; border-top:2px solid #ddd6fe;">
								<td colspan="2" style="font-weight:700; padding:10px 14px;">DOLAYLI MALİYET TOPLAMI</td>
								<td style="text-align:right; font-weight:700; color:#7c3aed; padding:10px 14px; font-size:1.1em;">${formatCurrencyLocal(indirectCostsTotal)}</td>
							</tr>
						</tbody>
					</table>
				</div>
			`;
		}

		// Birim dağılımı bölümü (ayrı profesyonel blok)
		let allocationSectionHtml = '';
		if (record.cost_allocations && record.cost_allocations.length > 0) {
			const totalAmt = record.amount || 0;
			const allocRowsHtml = record.cost_allocations.map(a => {
				const pct = parseFloat(a.percentage) || 0;
				const amt = a.amount ?? totalAmt * pct / 100;
				const amtStr = (typeof amt === 'number' ? amt : 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
				const isSupplier = a.type === 'supplier';
				return `
					<tr>
						<td style="font-weight:600; padding:10px 14px;">${a.unit}${isSupplier ? ' <span style="padding:2px 6px; border-radius:4px; font-size:0.75em; font-weight:600; background-color:#fef3c7; color:#92400e;">Tedarikçi</span>' : ''}</td>
						<td style="text-align:center; padding:10px 14px;">
							<div style="display:flex; align-items:center; gap:8px; justify-content:center;">
								<div style="flex:1; max-width:120px; height:8px; background:#e5e7eb; border-radius:4px; overflow:hidden;">
									<div style="width:${pct}%; height:100%; background:linear-gradient(90deg,#6366f1,#818cf8); border-radius:4px;"></div>
								</div>
								<span style="font-weight:700; color:#4338ca;">%${pct.toFixed(1)}</span>
							</div>
						</td>
						<td style="text-align:right; font-weight:700; color:#dc2626; padding:10px 14px;">${amtStr}</td>
					</tr>`;
			}).join('');
			allocationSectionHtml = `
				<div class="section">
					<h2 class="section-title section-title-strip blue">MALİYET BİRİM DAĞILIMI</h2>
					<table style="width:100%; border-collapse:collapse; margin-top:10px; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
						<thead>
							<tr style="background:#f8fafc; border-bottom:2px solid #4338ca;">
								<th style="text-align:left; padding:12px 14px; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; color:#1f2937;">Birim / Tedarikçi</th>
								<th style="text-align:center; padding:12px 14px; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; color:#1f2937;">Oran</th>
								<th style="text-align:right; padding:12px 14px; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; color:#1f2937;">Tutar</th>
							</tr>
						</thead>
						<tbody>
							${allocRowsHtml}
							<tr style="background:#f8fafc; border-top:2px solid #e5e7eb;">
								<td style="font-weight:700; padding:10px 14px;">TOPLAM</td>
								<td style="text-align:center; padding:10px 14px; font-weight:700;">%100</td>
								<td style="text-align:right; font-weight:700; color:#dc2626; padding:10px 14px; font-size:1.1em;">${formatCurrencyLocal(totalAmt)}</td>
							</tr>
						</tbody>
					</table>
				</div>
			`;
		}

		// Genel bilgiler tablosu
		const generalInfoRows = [];
		if (record.invoice_number) generalInfoRows.push(`<tr><td style="font-weight: 600; width: 30%;">Fatura/Referans No</td><td>${record.invoice_number}</td></tr>`);
		if (record.reporting_unit) generalInfoRows.push(`<tr><td style="font-weight: 600; width: 30%;">Raporlayan Birim</td><td style="color: #7c3aed; font-weight: 600;">${record.reporting_unit}</td></tr>`);
		if (record.unit) generalInfoRows.push(`<tr><td style="font-weight: 600; width: 30%;">Birim (Kaynak)</td><td>${record.unit}</td></tr>`);
		if (record.vehicle_type) generalInfoRows.push(`<tr><td style="font-weight: 600;">Araç Türü</td><td>${record.vehicle_type}</td></tr>`);
		if (record.part_code) generalInfoRows.push(`<tr><td style="font-weight: 600;">Parça Kodu</td><td>${record.part_code}</td></tr>`);
		if (record.part_name) generalInfoRows.push(`<tr><td style="font-weight: 600;">Parça Adı</td><td>${record.part_name}</td></tr>`);
		if (record.quantity) generalInfoRows.push(`<tr><td style="font-weight: 600;">Miktar</td><td>${record.quantity}</td></tr>`);
		if (record.measurement_unit) generalInfoRows.push(`<tr><td style="font-weight: 600;">Ölçü Birimi</td><td>${record.measurement_unit}</td></tr>`);
		if (record.scrap_weight) generalInfoRows.push(`<tr><td style="font-weight: 600;">Hurda Ağırlığı (kg)</td><td>${record.scrap_weight}</td></tr>`);
		if (record.customer_name && record.cost_type === 'Dış Hata Maliyeti') generalInfoRows.push(`<tr><td style="font-weight: 600;">Müşteri Adı</td><td style="color: #2563eb; font-weight: 600;">${record.customer_name}</td></tr>`);
		if (record.status) generalInfoRows.push(`<tr><td style="font-weight: 600;">Durum</td><td>${record.status}</td></tr>`);

		const generalInfoHtml = generalInfoRows.length > 0
			? `<table class="info-table" style="width: 100%; margin-bottom: 20px;">
				<tbody>
					${generalInfoRows.join('')}
				</tbody>
			</table>`
			: '';

		// Tedarikçi bilgisi
		const supplierInfoHtml = record.is_supplier_nc && record.supplier?.name
			? `<div style="background-color: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
				<div style="font-weight: 600; color: #92400e; margin-bottom: 8px;">Tedarikçi Kaynaklı Maliyet</div>
				<div style="font-size: 16px; color: #78350f; font-weight: 600;">${record.supplier.name}</div>
				${record.is_reflected_to_supplier ? '<div style="margin-top: 8px; padding: 4px 8px; background: #dcfce7; border-radius: 4px; font-size: 12px; color: #166534; font-weight: 600; display: inline-block;">✓ Tedarikçiye Yansıtıldı</div>' : ''}
			</div>`
			: '';

		// Yeniden İşlem Maliyeti Detayları
		let reworkDetailsHtml = '';
		if (record.cost_type === 'Yeniden İşlem Maliyeti') {
			const mainReworkCost = record.rework_duration && record.unit
				? `${record.unit}: ${record.rework_duration} dk`
				: record.rework_duration
					? `(Ana: ${record.rework_duration} dk)`
					: '';

			const affectedUnitsCosts = record.affected_units && Array.isArray(record.affected_units) && record.affected_units.length > 0
				? record.affected_units
					.filter(au => au.unit !== record.unit)
					.map(au => `${au.unit}: ${au.duration} dk`)
					.join(', ')
				: '';

			const reworkDetails = [mainReworkCost, affectedUnitsCosts].filter(Boolean).join(' | ');

			if (reworkDetails) {
				reworkDetailsHtml = `
					<div class="section">
						<h2 class="section-title section-title-strip blue">İŞLEM SÜRELERİ</h2>
						<div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin-top: 10px;">
							<p style="margin: 0; font-size: 14px;">${reworkDetails}</p>
						</div>
					</div>
				`;
			}
		}

		// Final Hataları Maliyeti Detayları
		let finalFaultsDetailsHtml = '';
		if (record.cost_type === 'Final Hataları Maliyeti') {
			const finalFaultsRows = [];
			if (record.rework_duration) finalFaultsRows.push(`<tr><td style="font-weight: 600; width: 30%;">Giderilme Süresi</td><td>${record.rework_duration} dakika</td></tr>`);
			if (record.quality_control_duration) finalFaultsRows.push(`<tr><td style="font-weight: 600;">Kalite Kontrol Süresi</td><td>${record.quality_control_duration} dakika</td></tr>`);

			const affectedUnitsHtml = record.affected_units && Array.isArray(record.affected_units) && record.affected_units.length > 0
				? record.affected_units
					.filter(au => au.unit !== record.unit)
					.map(au => `<span style="display: inline-block; padding: 4px 12px; margin: 4px; border-radius: 4px; background-color: #e5e7eb; font-size: 0.85em;">${au.unit}: ${au.duration} dk</span>`)
					.join('')
				: '';

			if (finalFaultsRows.length > 0 || affectedUnitsHtml) {
				finalFaultsDetailsHtml = `
					<div class="section">
						<h2 class="section-title section-title-strip blue">SÜRE DETAYLARI</h2>
						${finalFaultsRows.length > 0 ? `<table class="info-table" style="width: 100%; margin-top: 10px; margin-bottom: 15px;">
							<tbody>
								${finalFaultsRows.join('')}
							</tbody>
						</table>` : ''}
						${affectedUnitsHtml ? `<div style="margin-top: 15px;">
							<div style="font-weight: 600; margin-bottom: 8px;">Etkilenen Birimler:</div>
							<div>${affectedUnitsHtml}</div>
						</div>` : ''}
					</div>
				`;
			}
		}

		// Kanıt dokümanları (linkler ile)
		let documentsHtml = '';
		if (record._documents && Array.isArray(record._documents) && record._documents.length > 0) {
			const docRowsHtml = record._documents.map(doc => {
				const docUrl = doc.url || '#';
				const docName = doc.document_name || doc.file_path || '-';
				return `<tr>
					<td style="padding:8px 14px;"><a href="${docUrl}" target="_blank" rel="noopener noreferrer" style="color:#2563eb; text-decoration:underline; font-weight:600;">${docName}</a></td>
					<td style="padding:8px 14px;">${doc.document_type || '-'}</td>
					<td style="padding:8px 14px; font-size:0.85em; color:#64748b;">${doc.file_size ? (doc.file_size / 1024).toFixed(1) + ' KB' : '-'}</td>
				</tr>`;
			}).join('');
			documentsHtml = `
				<div class="section">
					<h2 class="section-title section-title-strip blue">KANIT DOKÜMANLAR</h2>
					<table style="width:100%; border-collapse:collapse; margin-top:10px; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
						<thead>
							<tr style="background:#f8fafc; border-bottom:2px solid #2563eb;">
								<th style="text-align:left; padding:12px 14px; font-size:12px; font-weight:600; text-transform:uppercase; color:#1f2937;">Doküman</th>
								<th style="text-align:left; padding:12px 14px; font-size:12px; font-weight:600; text-transform:uppercase; color:#1f2937;">Tür</th>
								<th style="text-align:left; padding:12px 14px; font-size:12px; font-weight:600; text-transform:uppercase; color:#1f2937;">Boyut</th>
							</tr>
						</thead>
						<tbody>${docRowsHtml}</tbody>
					</table>
				</div>`;
		}

		// Açıklama (XSS koruması ile)
		const descEscaped = record.description ? String(record.description).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>') : '';
		const descriptionHtml = record.description
			? `<div class="section">
				<h2 class="section-title section-title-strip blue">${record.cost_type === 'Final Hataları Maliyeti' ? 'HATA AÇIKLAMASI' : 'AÇIKLAMA'}</h2>
				<div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-top: 10px;">
					<div style="white-space: pre-wrap; word-wrap: break-word; margin: 0; font-family: inherit; line-height: 1.6; font-size: 13px;">${descEscaped}</div>
				</div>
			</div>`
			: '';

		// quality_cost_detail için summaryHtml oluştur (header ve meta-box için)
		summaryHtml = `
			${mainInfoHtml}
			${supplierInfoHtml}
			<div class="section">
				<h2 class="section-title section-title-strip blue">GENEL BİLGİLER</h2>
				${generalInfoHtml}
			</div>
			${lineItemsSectionHtml}
			${sharedCostsSectionHtml}
			${indirectCostsSectionHtml}
			${allocationSectionHtml}
			${reworkDetailsHtml}
			${finalFaultsDetailsHtml}
			${descriptionHtml}
			${documentsHtml}
		`;

		// Header ve meta-box generateListReportHtml'in sonunda oluşturulacak, burada sadece içeriği hazırlıyoruz
		headers = [];
		rowsHtml = '';
	} else if (type === 'quality_cost_executive_summary') {
		title = record.unit ? `${record.unit} Birimi-Kalite Maliyeti Yönetici Özeti Raporu` : 'Kalite Maliyeti Yönetici Özeti Raporu';

		// Veri kontrolü - eğer veri yoksa hata mesajı göster
		if (!record || typeof record !== 'object') {
			summaryHtml = '<p style="color: #dc2626; font-weight: 600;">Rapor verisi bulunamadı. Lütfen tekrar deneyin.</p>';
			headers = [];
			rowsHtml = '';
		} else {
			const formatCurrencyLocal = (value) => (value || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
			const formatPercent = (value) => (value || 0).toFixed(2);
			const formatDateLocal = (dateStr) => formatDateHelper(dateStr, 'dd.MM.yyyy');

			const periodInfo = [
				record.unit ? `Birim: ${record.unit}` : null,
				record.periodStart && record.periodEnd
					? `${record.periodStart} - ${record.periodEnd}`
					: record.period || 'Tüm Zamanlar',
			].filter(Boolean).join(' | ');

			// Birim bazlı toplamlar - payı olan TÜM birimler (allUnits varsa)
			const unitsForDisplay = (record.allUnits && record.allUnits.length > 0) ? record.allUnits : (record.topUnits || []);
			const unitTotalsHtml = unitsForDisplay.length > 0 ? `
			<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
				<h3 style="font-size: 14px; font-weight: 700; color: #1e40af; margin-bottom: 12px; border-bottom: 2px solid #3b82f6; padding-bottom: 6px;">Birim Bazlı Toplam Maliyetler (Payı Olan Tüm Birimler)</h3>
				<div style="display: flex; flex-wrap: wrap; gap: 12px;">
					${unitsForDisplay.map(u => `<span style="background: white; padding: 8px 14px; border-radius: 6px; border-left: 4px solid #2563eb; font-size: 13px;"><strong>${u.unit}:</strong> ${formatCurrencyLocal(u.totalAmount)}</span>`).join('')}
				</div>
				<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-weight: 700; color: #dc2626;">Genel Toplam: ${formatCurrencyLocal(record.totalCost)}</div>
			</div>
			` : '';

			// Genel Özet Kartları - Profesyonel şerit stili (renkli sol kenar)
			const summaryCardsHtml = `
			${unitTotalsHtml}
			<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px;">
				<div style="background-color: #ffffff; border-radius: 8px; padding: 20px; text-align: left; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border: 1px solid #e5e7eb; border-left: 5px solid #2563eb;">
					<div style="font-size: 10px; margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">Toplam Maliyet</div>
					<div style="font-size: 22px; font-weight: 700; margin-bottom: 6px; color: #1f2937;">${formatCurrencyLocal(record.totalCost)}</div>
					<div style="font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 8px;">${record.totalCount} kayıt</div>
				</div>
				<div style="background-color: #ffffff; border-radius: 8px; padding: 20px; text-align: left; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border: 1px solid #e5e7eb; border-left: 5px solid #dc2626;">
					<div style="font-size: 10px; margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">İç Hata</div>
					<div style="font-size: 22px; font-weight: 700; margin-bottom: 6px; color: #1f2937;">${formatCurrencyLocal(record.internalCost)}</div>
					<div style="font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 8px;">%${formatPercent(record.internalPercentage)}</div>
				</div>
				<div style="background-color: #ffffff; border-radius: 8px; padding: 20px; text-align: left; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border: 1px solid #e5e7eb; border-left: 5px solid #2563eb;">
					<div style="font-size: 10px; margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">Dış Hata</div>
					<div style="font-size: 22px; font-weight: 700; margin-bottom: 6px; color: #1f2937;">${formatCurrencyLocal(record.externalCost)}</div>
					<div style="font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 8px;">%${formatPercent(record.externalPercentage)}</div>
				</div>
			</div>
			<div style="display: grid; grid-template-columns: 1fr; gap: 20px; margin-bottom: 30px;">
				<div style="background-color: #ffffff; border-radius: 8px; padding: 20px; text-align: left; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border: 1px solid #e5e7eb; border-left: 5px solid #374151;">
					<div style="font-size: 10px; margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">COPQ Toplam (Cost of Poor Quality)</div>
					<div style="font-size: 24px; font-weight: 700; margin-bottom: 6px; color: #1f2937;">${formatCurrencyLocal(record.internalCost + record.externalCost + record.appraisalCost + record.preventionCost)}</div>
					<div style="font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 8px;">İç Hata + Dış Hata + Değerlendirme + Önleme</div>
				</div>
			</div>
		`;

			// COPQ Kategorileri - Profesyonel renkler
			const copqCategoriesHtml = `
			<div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 30px; border: 1px solid #e5e7eb;">
				<h3 style="font-size: 16px; font-weight: 700; color: #1e40af; margin-bottom: 15px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">COPQ Kategorileri (Cost of Poor Quality)</h3>
				<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
					<div style="background-color: white; border-radius: 6px; padding: 18px; border-left: 4px solid #dc2626; border: 1px solid #e5e7eb;">
						<div style="font-size: 12px; color: #6b7280; margin-bottom: 8px; font-weight: 600;">İç Hata Maliyetleri</div>
						<div style="font-size: 20px; font-weight: 700; color: #1f2937; margin-bottom: 4px;">${formatCurrencyLocal(record.internalCost)}</div>
						<div style="font-size: 11px; color: #6b7280; margin-top: 4px;">%${formatPercent(record.internalPercentage)}</div>
					</div>
					<div style="background-color: white; border-radius: 6px; padding: 18px; border-left: 4px solid #2563eb; border: 1px solid #e5e7eb;">
						<div style="font-size: 12px; color: #6b7280; margin-bottom: 8px; font-weight: 600;">Dış Hata Maliyetleri</div>
						<div style="font-size: 20px; font-weight: 700; color: #1f2937; margin-bottom: 4px;">${formatCurrencyLocal(record.externalCost)}</div>
						<div style="font-size: 11px; color: #6b7280; margin-top: 4px;">%${formatPercent(record.externalPercentage)}</div>
					</div>
					<div style="background-color: white; border-radius: 6px; padding: 18px; border-left: 4px solid #059669; border: 1px solid #e5e7eb;">
						<div style="font-size: 12px; color: #6b7280; margin-bottom: 8px; font-weight: 600;">Değerlendirme Maliyetleri</div>
						<div style="font-size: 20px; font-weight: 700; color: #1f2937; margin-bottom: 4px;">${formatCurrencyLocal(record.appraisalCost)}</div>
						<div style="font-size: 11px; color: #6b7280; margin-top: 4px;">%${formatPercent(record.appraisalPercentage)}</div>
					</div>
					<div style="background-color: white; border-radius: 6px; padding: 18px; border-left: 4px solid #7c3aed; border: 1px solid #e5e7eb;">
						<div style="font-size: 12px; color: #6b7280; margin-bottom: 8px; font-weight: 600;">Önleme Maliyetleri</div>
						<div style="font-size: 20px; font-weight: 700; color: #1f2937; margin-bottom: 4px;">${formatCurrencyLocal(record.preventionCost)}</div>
						<div style="font-size: 11px; color: #6b7280; margin-top: 4px;">%${formatPercent(record.preventionPercentage)}</div>
					</div>
				</div>
			</div>
		`;

			// En Çok Hata Türleri Tablosu
			const topCostTypesHtml = record.topCostTypes && record.topCostTypes.length > 0
				? `
				<h3 style="font-size: 18px; font-weight: 700; color: #1e40af; margin-bottom: 15px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">En Çok Hata Türleri (Top 10)</h3>
				<table class="info-table results-table" style="margin-bottom: 30px; width: 100%;">
					<thead>
						<tr style="background-color: #1e40af; color: white;">
							<th style="width: 5%; padding: 12px; text-align: center;">#</th>
							<th style="width: 40%; padding: 12px; text-align: left;">Maliyet Türü</th>
							<th style="width: 15%; padding: 12px; text-align: right;">Toplam Maliyet</th>
							<th style="width: 15%; padding: 12px; text-align: center;">Kayıt Sayısı</th>
							<th style="width: 15%; padding: 12px; text-align: right;">Yüzde</th>
							<th style="width: 10%; padding: 12px; text-align: center;">Ortalama</th>
						</tr>
					</thead>
					<tbody>
						${record.topCostTypes.map((item, idx) => `
							<tr style="border-bottom: 1px solid #e5e7eb;">
								<td style="padding: 12px; text-align: center; font-weight: 600; color: #6b7280;">${idx + 1}</td>
								<td style="padding: 12px; font-weight: 600; color: #111827;">${item.type}</td>
								<td style="padding: 12px; text-align: right; font-weight: 700; color: #dc2626;">${formatCurrencyLocal(item.totalAmount)}</td>
								<td style="padding: 12px; text-align: center; color: #6b7280;">${item.count}</td>
								<td style="padding: 12px; text-align: right; color: #059669; font-weight: 600;">%${formatPercent(item.percentage)}</td>
								<td style="padding: 12px; text-align: center; color: #6b7280; font-size: 0.9em;">${formatCurrencyLocal(item.totalAmount / item.count)}</td>
							</tr>
						`).join('')}
					</tbody>
				</table>
			`
				: '';

			// En Çok Maliyetli Birimler/Tedarikçiler Tablosu
			const topUnitsHtml = record.topUnits && record.topUnits.length > 0
				? `
				<h3 style="font-size: 18px; font-weight: 700; color: #1e40af; margin-bottom: 15px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">En Çok Maliyetli Birimler/Tedarikçiler (Top 10)</h3>
				<table class="info-table results-table" style="margin-bottom: 30px; width: 100%;">
					<thead>
						<tr style="background-color: #1e40af; color: white;">
							<th style="width: 5%; padding: 12px; text-align: center;">#</th>
							<th style="width: 45%; padding: 12px; text-align: left;">Birim/Tedarikçi</th>
							<th style="width: 20%; padding: 12px; text-align: right;">Toplam Maliyet</th>
							<th style="width: 15%; padding: 12px; text-align: center;">Kayıt Sayısı</th>
							<th style="width: 15%; padding: 12px; text-align: right;">Yüzde</th>
						</tr>
					</thead>
					<tbody>
						${record.topUnits.map((item, idx) => `
							<tr style="border-bottom: 1px solid #e5e7eb;">
								<td style="padding: 12px; text-align: center; font-weight: 600; color: #6b7280;">${idx + 1}</td>
								<td style="padding: 12px; font-weight: 600; color: #111827;">
									${item.unit}
								</td>
								<td style="padding: 12px; text-align: right; font-weight: 700; color: #dc2626;">${formatCurrencyLocal(item.totalAmount)}</td>
								<td style="padding: 12px; text-align: center; color: #6b7280;">${item.count}</td>
								<td style="padding: 12px; text-align: right; color: #059669; font-weight: 600;">%${formatPercent(item.percentage)}</td>
							</tr>
						`).join('')}
					</tbody>
				</table>
			`
				: '';

			// En Çok Maliyetli Parçalar Tablosu
			const topPartsHtml = record.topParts && record.topParts.length > 0
				? `
				<h3 style="font-size: 18px; font-weight: 700; color: #1e40af; margin-bottom: 15px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">En Çok Maliyetli Parçalar (Top 10)</h3>
				<table class="info-table results-table" style="margin-bottom: 30px; width: 100%;">
					<thead>
						<tr style="background-color: #1e40af; color: white;">
							<th style="width: 5%; padding: 12px; text-align: center;">#</th>
							<th style="width: 20%; padding: 12px; text-align: left;">Parça Kodu</th>
							<th style="width: 25%; padding: 12px; text-align: left;">Parça Adı</th>
							<th style="width: 20%; padding: 12px; text-align: right;">Toplam Maliyet</th>
							<th style="width: 15%; padding: 12px; text-align: center;">Kayıt Sayısı</th>
							<th style="width: 15%; padding: 12px; text-align: right;">Yüzde</th>
						</tr>
					</thead>
					<tbody>
						${record.topParts.map((item, idx) => `
							<tr style="border-bottom: 1px solid #e5e7eb;">
								<td style="padding: 12px; text-align: center; font-weight: 600; color: #6b7280;">${idx + 1}</td>
								<td style="padding: 12px; font-weight: 600; color: #111827; font-family: monospace;">${item.partCode}</td>
								<td style="padding: 12px; color: #6b7280;">${item.partName}</td>
								<td style="padding: 12px; text-align: right; font-weight: 700; color: #dc2626;">${formatCurrencyLocal(item.totalAmount)}</td>
								<td style="padding: 12px; text-align: center; color: #6b7280;">${item.count}</td>
								<td style="padding: 12px; text-align: right; color: #059669; font-weight: 600;">%${formatPercent(item.percentage)}</td>
							</tr>
						`).join('')}
					</tbody>
				</table>
			`
				: '';

			// En Çok Maliyetli Araç Tipleri Tablosu
			const topVehicleTypesHtml = record.topVehicleTypes && record.topVehicleTypes.length > 0
				? `
				<h3 style="font-size: 18px; font-weight: 700; color: #1e40af; margin-bottom: 15px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">En Çok Maliyetli Araç Tipleri (Top 10)</h3>
				<table class="info-table results-table" style="margin-bottom: 30px; width: 100%;">
					<thead>
						<tr style="background-color: #1e40af; color: white;">
							<th style="width: 5%; padding: 12px; text-align: center;">#</th>
							<th style="width: 50%; padding: 12px; text-align: left;">Araç Tipi</th>
							<th style="width: 20%; padding: 12px; text-align: right;">Toplam Maliyet</th>
							<th style="width: 15%; padding: 12px; text-align: center;">Kayıt Sayısı</th>
							<th style="width: 10%; padding: 12px; text-align: right;">Yüzde</th>
						</tr>
					</thead>
					<tbody>
						${record.topVehicleTypes.map((item, idx) => `
							<tr style="border-bottom: 1px solid #e5e7eb;">
								<td style="padding: 12px; text-align: center; font-weight: 600; color: #6b7280;">${idx + 1}</td>
								<td style="padding: 12px; font-weight: 600; color: #111827;">${item.vehicleType}</td>
								<td style="padding: 12px; text-align: right; font-weight: 700; color: #dc2626;">${formatCurrencyLocal(item.totalAmount)}</td>
								<td style="padding: 12px; text-align: center; color: #6b7280;">${item.count}</td>
								<td style="padding: 12px; text-align: right; color: #059669; font-weight: 600;">%${formatPercent(item.percentage)}</td>
							</tr>
						`).join('')}
					</tbody>
				</table>
			`
				: '';

			// Tedarikçi Bazlı Analiz Tablosu
			const topSuppliersHtml = record.topSuppliers && record.topSuppliers.length > 0
				? `
				<h3 style="font-size: 18px; font-weight: 700; color: #1e40af; margin-bottom: 15px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">Tedarikçi Bazlı Analiz (Top 10)</h3>
				<table class="info-table results-table" style="margin-bottom: 30px; width: 100%;">
					<thead>
						<tr style="background-color: #f59e0b; color: white;">
							<th style="width: 5%; padding: 12px; text-align: center;">#</th>
							<th style="width: 50%; padding: 12px; text-align: left;">Tedarikçi</th>
							<th style="width: 20%; padding: 12px; text-align: right;">Toplam Maliyet</th>
							<th style="width: 15%; padding: 12px; text-align: center;">Kayıt Sayısı</th>
							<th style="width: 10%; padding: 12px; text-align: right;">Yüzde</th>
						</tr>
					</thead>
					<tbody>
						${record.topSuppliers.map((item, idx) => `
							<tr style="border-bottom: 1px solid #e5e7eb;">
								<td style="padding: 12px; text-align: center; font-weight: 600; color: #6b7280;">${idx + 1}</td>
								<td style="padding: 12px; font-weight: 600; color: #111827;">${item.supplier}</td>
								<td style="padding: 12px; text-align: right; font-weight: 700; color: #dc2626;">${formatCurrencyLocal(item.totalAmount)}</td>
								<td style="padding: 12px; text-align: center; color: #6b7280;">${item.count}</td>
								<td style="padding: 12px; text-align: right; color: #059669; font-weight: 600;">%${formatPercent(item.percentage)}</td>
							</tr>
						`).join('')}
					</tbody>
				</table>
			`
				: '';

			// Aylık Trend Analizi Tablosu
			const monthlyTrendHtml = record.monthlyData && record.monthlyData.length > 0
				? `
				<h3 style="font-size: 18px; font-weight: 700; color: #1e40af; margin-bottom: 15px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">Aylık Trend Analizi (Son 12 Ay)</h3>
				<table class="info-table results-table" style="margin-bottom: 30px; width: 100%;">
					<thead>
						<tr style="background-color: #10b981; color: white;">
							<th style="width: 30%; padding: 12px; text-align: left;">Ay</th>
							<th style="width: 25%; padding: 12px; text-align: right;">Toplam Maliyet</th>
							<th style="width: 25%; padding: 12px; text-align: center;">Kayıt Sayısı</th>
							<th style="width: 20%; padding: 12px; text-align: right;">Ortalama</th>
						</tr>
					</thead>
					<tbody>
						${record.monthlyData.map((item, idx) => `
							<tr style="border-bottom: 1px solid #e5e7eb;">
								<td style="padding: 12px; font-weight: 600; color: #111827;">${item.month}</td>
								<td style="padding: 12px; text-align: right; font-weight: 700; color: #dc2626;">${formatCurrencyLocal(item.totalAmount)}</td>
								<td style="padding: 12px; text-align: center; color: #6b7280;">${item.count}</td>
								<td style="padding: 12px; text-align: right; color: #059669; font-weight: 600;">${formatCurrencyLocal(item.totalAmount / item.count)}</td>
							</tr>
						`).join('')}
					</tbody>
				</table>
			`
				: '';

			summaryHtml = `
			<div style="margin-bottom: 25px;">
				<p style="font-size: 14px; color: #6b7280; margin-bottom: 5px;"><strong>Rapor Tarihi:</strong> ${record.reportDate || formatDateLocal(new Date().toISOString())}</p>
				<p style="font-size: 14px; color: #6b7280; margin-bottom: 5px;"><strong>Dönem:</strong> ${periodInfo}</p>
				<p style="font-size: 14px; color: #6b7280;"><strong>Toplam Kayıt Sayısı:</strong> ${record.totalCount || 0}</p>
			</div>
			${summaryCardsHtml}
			${copqCategoriesHtml}
			${topCostTypesHtml}
			${topUnitsHtml}
			${topPartsHtml}
			${topVehicleTypesHtml}
			${topSuppliersHtml}
			${monthlyTrendHtml}
		`;

			// Bu rapor için tablo gerekmediği için boş bırakıyoruz
			headers = [];
			rowsHtml = '';
		}
	} else if (type === 'produced_vehicles_executive_summary') {
		title = 'Üretilen Araçlar Yönetici Özeti Raporu';

		// Veri kontrolü
		if (!record || typeof record !== 'object') {
			summaryHtml = '<p style="color: #dc2626; font-weight: 600;">Rapor verisi bulunamadı. Lütfen tekrar deneyin.</p>';
			headers = [];
			rowsHtml = '';
		} else {
			const formatNumber = (value) => (value || 0).toLocaleString('tr-TR');
			const formatPercent = (value) => (value || 0).toFixed(2);
			const formatDateLocal = (dateStr) => formatDateHelper(dateStr, 'dd.MM.yyyy');

			const periodInfo = record.periodStart && record.periodEnd
				? `${record.periodStart} - ${record.periodEnd}`
				: record.period || 'Tüm Zamanlar';

			// Genel Özet Kartları
			const summaryCardsHtml = `
				<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px;">
					<div style="background-color: #1e40af; border-radius: 8px; padding: 24px; color: white; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-left: 4px solid #3b82f6;">
						<div style="font-size: 11px; opacity: 0.9; margin-bottom: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">TOPLAM ARAÇ</div>
						<div style="font-size: 26px; font-weight: 700; margin-bottom: 8px;">${formatNumber(record.totalVehicles)}</div>
						<div style="font-size: 10px; opacity: 0.85; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px; margin-top: 8px;">Araç kaydı</div>
					</div>
					<div style="background-color: #dc2626; border-radius: 8px; padding: 24px; color: white; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-left: 4px solid #ef4444;">
						<div style="font-size: 11px; opacity: 0.9; margin-bottom: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">TOPLAM HATA</div>
						<div style="font-size: 26px; font-weight: 700; margin-bottom: 8px;">${formatNumber(record.totalFaults)}</div>
						<div style="font-size: 10px; opacity: 0.85; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px; margin-top: 8px;">${formatNumber(record.activeFaults)} aktif</div>
					</div>
					<div style="background-color: #059669; border-radius: 8px; padding: 24px; color: white; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-left: 4px solid #10b981;">
						<div style="font-size: 11px; opacity: 0.9; margin-bottom: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">GİDERİLEN HATA</div>
						<div style="font-size: 26px; font-weight: 700; margin-bottom: 8px;">${formatNumber(record.resolvedFaults)}</div>
						<div style="font-size: 10px; opacity: 0.85; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px; margin-top: 8px;">%${formatPercent(record.faultResolutionRate)}</div>
					</div>
				</div>
				<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px;">
					<div style="background-color: #7c3aed; border-radius: 8px; padding: 24px; color: white; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-left: 4px solid #a78bfa;">
						<div style="font-size: 11px; opacity: 0.9; margin-bottom: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">ORTALAMA KONTROL SÜRESİ</div>
						<div style="font-size: 26px; font-weight: 700; margin-bottom: 8px;">${record.averageControlDuration || '0 dk'}</div>
						<div style="font-size: 10px; opacity: 0.85; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px; margin-top: 8px;">Saat ve Dakika</div>
					</div>
					<div style="background-color: #dc2626; border-radius: 8px; padding: 24px; color: white; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-left: 4px solid #ef4444;">
						<div style="font-size: 11px; opacity: 0.9; margin-bottom: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">ORTALAMA YENİDEN İŞLEM SÜRESİ</div>
						<div style="font-size: 26px; font-weight: 700; margin-bottom: 8px;">${record.averageReworkDuration || '0 dk'}</div>
						<div style="font-size: 10px; opacity: 0.85; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px; margin-top: 8px;">Dinamik Hesaplama</div>
					</div>
				</div>
				<div style="display: grid; grid-template-columns: repeat(1, 1fr); gap: 20px; margin-bottom: 30px;">
					<div style="background-color: #f59e0b; border-radius: 8px; padding: 24px; color: white; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-left: 4px solid #fbbf24;">
						<div style="font-size: 11px; opacity: 0.9; margin-bottom: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">AKTİF HATA</div>
						<div style="font-size: 26px; font-weight: 700; margin-bottom: 8px;">${formatNumber(record.activeFaults)}</div>
						<div style="font-size: 10px; opacity: 0.85; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px; margin-top: 8px;">Çözüm bekliyor</div>
					</div>
				</div>
			`;

			// Durum Bazlı Analiz
			const statusAnalysisHtml = record.statusAnalysis && record.statusAnalysis.length > 0
				? `
					<h3 style="font-size: 18px; font-weight: 700; color: #1e40af; margin-bottom: 15px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">Durum Bazlı Analiz</h3>
					<table class="info-table results-table" style="margin-bottom: 30px; width: 100%;">
						<thead>
							<tr style="background-color: #1e40af; color: white;">
								<th style="width: 5%; padding: 12px; text-align: center;">#</th>
								<th style="width: 50%; padding: 12px; text-align: left;">Durum</th>
								<th style="width: 20%; padding: 12px; text-align: center;">Araç Sayısı</th>
								<th style="width: 25%; padding: 12px; text-align: right;">Yüzde</th>
							</tr>
						</thead>
						<tbody>
							${record.statusAnalysis.map((item, idx) => `
								<tr style="border-bottom: 1px solid #e5e7eb;">
									<td style="padding: 12px; text-align: center; font-weight: 600; color: #6b7280;">${idx + 1}</td>
									<td style="padding: 12px; font-weight: 600; color: #111827;">${item.status}</td>
									<td style="padding: 12px; text-align: center; color: #6b7280;">${formatNumber(item.count)}</td>
									<td style="padding: 12px; text-align: right; color: #059669; font-weight: 600;">%${formatPercent(item.percentage)}</td>
								</tr>
							`).join('')}
						</tbody>
					</table>
				`
				: '';

			// En Çok Üretilen Araç Tipleri
			const topVehicleTypesHtml = record.topVehicleTypes && record.topVehicleTypes.length > 0
				? `
					<h3 style="font-size: 18px; font-weight: 700; color: #1e40af; margin-bottom: 15px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">En Çok Üretilen Araç Tipleri (Top 10)</h3>
					<table class="info-table results-table" style="margin-bottom: 30px; width: 100%;">
						<thead>
							<tr style="background-color: #1e40af; color: white;">
								<th style="width: 5%; padding: 12px; text-align: center;">#</th>
								<th style="width: 35%; padding: 12px; text-align: left;">Araç Tipi</th>
								<th style="width: 15%; padding: 12px; text-align: center;">Araç Sayısı</th>
								<th style="width: 15%; padding: 12px; text-align: right;">Yüzde</th>
								<th style="width: 15%; padding: 12px; text-align: center;">Toplam Hata</th>
								<th style="width: 15%; padding: 12px; text-align: center;">Aktif Hata</th>
							</tr>
						</thead>
						<tbody>
							${record.topVehicleTypes.map((item, idx) => `
								<tr style="border-bottom: 1px solid #e5e7eb;">
									<td style="padding: 12px; text-align: center; font-weight: 600; color: #6b7280;">${idx + 1}</td>
									<td style="padding: 12px; font-weight: 600; color: #111827;">${item.vehicleType}</td>
									<td style="padding: 12px; text-align: center; color: #6b7280;">${formatNumber(item.count)}</td>
									<td style="padding: 12px; text-align: right; color: #059669; font-weight: 600;">%${formatPercent(item.percentage)}</td>
									<td style="padding: 12px; text-align: center; color: #dc2626; font-weight: 600;">${formatNumber(item.totalFaults)}</td>
									<td style="padding: 12px; text-align: center; color: #f59e0b; font-weight: 600;">${formatNumber(item.activeFaults)}</td>
								</tr>
							`).join('')}
						</tbody>
					</table>
				`
				: '';

			// En Çok Araç Üreten Müşteriler
			const topCustomersHtml = record.topCustomers && record.topCustomers.length > 0
				? `
					<h3 style="font-size: 18px; font-weight: 700; color: #1e40af; margin-bottom: 15px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">En Çok Araç Üreten Müşteriler (Top 10)</h3>
					<table class="info-table results-table" style="margin-bottom: 30px; width: 100%;">
						<thead>
							<tr style="background-color: #1e40af; color: white;">
								<th style="width: 5%; padding: 12px; text-align: center;">#</th>
								<th style="width: 40%; padding: 12px; text-align: left;">Müşteri</th>
								<th style="width: 20%; padding: 12px; text-align: center;">Araç Sayısı</th>
								<th style="width: 15%; padding: 12px; text-align: right;">Yüzde</th>
								<th style="width: 20%; padding: 12px; text-align: center;">Toplam Hata</th>
							</tr>
						</thead>
						<tbody>
							${record.topCustomers.map((item, idx) => `
								<tr style="border-bottom: 1px solid #e5e7eb;">
									<td style="padding: 12px; text-align: center; font-weight: 600; color: #6b7280;">${idx + 1}</td>
									<td style="padding: 12px; font-weight: 600; color: #111827;">${item.customer}</td>
									<td style="padding: 12px; text-align: center; color: #6b7280;">${formatNumber(item.count)}</td>
									<td style="padding: 12px; text-align: right; color: #059669; font-weight: 600;">%${formatPercent(item.percentage)}</td>
									<td style="padding: 12px; text-align: center; color: #dc2626; font-weight: 600;">${formatNumber(item.totalFaults)}</td>
								</tr>
							`).join('')}
						</tbody>
					</table>
				`
				: '';

			// En Çok Hata Olan Araçlar
			const vehiclesWithFaultsHtml = record.vehiclesWithFaults && record.vehiclesWithFaults.length > 0
				? `
					<h3 style="font-size: 18px; font-weight: 700; color: #1e40af; margin-bottom: 15px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">En Çok Hata Olan Araçlar (Top 10)</h3>
					<table class="info-table results-table" style="margin-bottom: 30px; width: 100%;">
						<thead>
							<tr style="background-color: #dc2626; color: white;">
								<th style="width: 5%; padding: 12px; text-align: center;">#</th>
								<th style="width: 15%; padding: 12px; text-align: left;">Şasi No</th>
								<th style="width: 25%; padding: 12px; text-align: left;">Araç Tipi</th>
								<th style="width: 20%; padding: 12px; text-align: left;">Müşteri</th>
								<th style="width: 15%; padding: 12px; text-align: center;">Toplam Hata</th>
								<th style="width: 10%; padding: 12px; text-align: center;">Aktif</th>
								<th style="width: 10%; padding: 12px; text-align: center;">Giderilen</th>
							</tr>
						</thead>
						<tbody>
							${record.vehiclesWithFaults.map((item, idx) => `
								<tr style="border-bottom: 1px solid #e5e7eb;">
									<td style="padding: 12px; text-align: center; font-weight: 600; color: #6b7280;">${idx + 1}</td>
									<td style="padding: 12px; font-weight: 600; color: #111827; font-family: monospace;">${item.chassisNo}</td>
									<td style="padding: 12px; color: #6b7280;">${item.vehicleType}</td>
									<td style="padding: 12px; color: #6b7280;">${item.customerName}</td>
									<td style="padding: 12px; text-align: center; font-weight: 700; color: #dc2626;">${formatNumber(item.totalFaults)}</td>
									<td style="padding: 12px; text-align: center; color: #f59e0b; font-weight: 600;">${formatNumber(item.activeFaults)}</td>
									<td style="padding: 12px; text-align: center; color: #059669; font-weight: 600;">${formatNumber(item.resolvedFaults)}</td>
								</tr>
							`).join('')}
						</tbody>
					</table>
				`
				: '';

			// DMO Durumu Analizi
			const dmoAnalysisHtml = record.dmoAnalysis && record.dmoAnalysis.length > 0
				? `
					<h3 style="font-size: 18px; font-weight: 700; color: #1e40af; margin-bottom: 15px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">DMO Durumu Analizi</h3>
					<table class="info-table results-table" style="margin-bottom: 30px; width: 100%;">
						<thead>
							<tr style="background-color: #7c3aed; color: white;">
								<th style="width: 5%; padding: 12px; text-align: center;">#</th>
								<th style="width: 50%; padding: 12px; text-align: left;">DMO Durumu</th>
								<th style="width: 25%; padding: 12px; text-align: center;">Araç Sayısı</th>
								<th style="width: 20%; padding: 12px; text-align: right;">Yüzde</th>
							</tr>
						</thead>
						<tbody>
							${record.dmoAnalysis.map((item, idx) => `
								<tr style="border-bottom: 1px solid #e5e7eb;">
									<td style="padding: 12px; text-align: center; font-weight: 600; color: #6b7280;">${idx + 1}</td>
									<td style="padding: 12px; font-weight: 600; color: #111827;">${item.status}</td>
									<td style="padding: 12px; text-align: center; color: #6b7280;">${formatNumber(item.count)}</td>
									<td style="padding: 12px; text-align: right; color: #059669; font-weight: 600;">%${formatPercent(item.percentage)}</td>
								</tr>
							`).join('')}
						</tbody>
					</table>
				`
				: '';

			// Aylık Trend Analizi
			const monthlyTrendHtml = record.monthlyData && record.monthlyData.length > 0
				? `
					<h3 style="font-size: 18px; font-weight: 700; color: #1e40af; margin-bottom: 15px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">Aylık Trend Analizi (Son 12 Ay)</h3>
					<table class="info-table results-table" style="margin-bottom: 30px; width: 100%;">
						<thead>
							<tr style="background-color: #10b981; color: white;">
								<th style="width: 20%; padding: 12px; text-align: left;">Ay</th>
								<th style="width: 15%; padding: 12px; text-align: center;">Araç Sayısı</th>
								<th style="width: 15%; padding: 12px; text-align: center;">Toplam Hata</th>
								<th style="width: 15%; padding: 12px; text-align: center;">Aktif Hata</th>
								<th style="width: 15%; padding: 12px; text-align: right;">Ortalama Hata / araç</th>
							</tr>
						</thead>
						<tbody>
							${record.monthlyData.map((item, idx) => `
								<tr style="border-bottom: 1px solid #e5e7eb;">
									<td style="padding: 12px; font-weight: 600; color: #111827;">${item.month}</td>
									<td style="padding: 12px; text-align: center; color: #6b7280;">${formatNumber(item.count)}</td>
									<td style="padding: 12px; text-align: center; color: #dc2626; font-weight: 600;">${formatNumber(item.totalFaults)}</td>
									<td style="padding: 12px; text-align: center; color: #f59e0b; font-weight: 600;">${formatNumber(item.activeFaults)}</td>
									<td style="padding: 12px; text-align: right; color: #059669; font-weight: 600;">${formatPercent(item.averageFaultsPerVehicle)}</td>
								</tr>
							`).join('')}
						</tbody>
					</table>
				`
				: '';

			summaryHtml = `
				<div style="margin-bottom: 25px;">
					<p style="font-size: 14px; color: #6b7280; margin-bottom: 5px;"><strong>Rapor Tarihi:</strong> ${record.reportDate || formatDateLocal(new Date().toISOString())}</p>
					<p style="font-size: 14px; color: #6b7280; margin-bottom: 5px;"><strong>Dönem:</strong> ${periodInfo}</p>
					<p style="font-size: 14px; color: #6b7280;"><strong>Toplam Araç Sayısı:</strong> ${formatNumber(record.totalVehicles)}</p>
				</div>
				${summaryCardsHtml}
				${statusAnalysisHtml}
				${topVehicleTypesHtml}
				${topCustomersHtml}
				${vehiclesWithFaultsHtml}
				${dmoAnalysisHtml}
				${monthlyTrendHtml}
			`;

			headers = [];
			rowsHtml = '';
		}
	} else if (type === 'incoming_quality_executive_summary') {
		title = 'Girdi Kalite Kontrol Yönetici Özeti Raporu';

		// Veri kontrolü - eğer veri yoksa hata mesajı göster
		if (!record || typeof record !== 'object') {
			summaryHtml = '<p style="color: #dc2626; font-weight: 600;">Rapor verisi bulunamadı. Lütfen tekrar deneyin.</p>';
			headers = [];
			rowsHtml = '';
		} else {
			const formatNumber = (value) => (value || 0).toLocaleString('tr-TR');
			const formatPercent = (value) => (value || 0).toFixed(2);
			const formatDateLocal = (dateStr) => formatDateHelper(dateStr, 'dd.MM.yyyy');

			const periodInfo = record.periodStart && record.periodEnd
				? `${record.periodStart} - ${record.periodEnd}`
				: record.period || 'Tüm Zamanlar';

			// Genel Özet Kartları
			const summaryCardsHtml = `
				<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px;">
					<div style="background-color: #1e40af; border-radius: 8px; padding: 24px; color: white; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-left: 4px solid #3b82f6;">
						<div style="font-size: 11px; opacity: 0.9; margin-bottom: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">TOPLAM KONTROL</div>
						<div style="font-size: 26px; font-weight: 700; margin-bottom: 8px;">${formatNumber(record.totalInspections)}</div>
						<div style="font-size: 10px; opacity: 0.85; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px; margin-top: 8px;">Muayene kaydı</div>
					</div>
					<div style="background-color: #059669; border-radius: 8px; padding: 24px; color: white; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-left: 4px solid #10b981;">
						<div style="font-size: 11px; opacity: 0.9; margin-bottom: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">KONTROL EDİLEN ÜRÜN</div>
						<div style="font-size: 26px; font-weight: 700; margin-bottom: 8px;">${formatNumber(record.totalProductsInspected)}</div>
						<div style="font-size: 10px; opacity: 0.85; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px; margin-top: 8px;">Adet</div>
					</div>
					<div style="background-color: #dc2626; border-radius: 8px; padding: 24px; color: white; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-left: 4px solid #ef4444;">
						<div style="font-size: 11px; opacity: 0.9; margin-bottom: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">RET EDİLEN ÜRÜN</div>
						<div style="font-size: 26px; font-weight: 700; margin-bottom: 8px;">${formatNumber(record.totalProductsRejected)}</div>
						<div style="font-size: 10px; opacity: 0.85; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px; margin-top: 8px;">%${formatPercent(record.rejectionRate)}</div>
					</div>
				</div>
				<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px;">
					<div style="background-color: #2563eb; border-radius: 8px; padding: 24px; color: white; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-left: 4px solid #60a5fa;">
						<div style="font-size: 11px; opacity: 0.9; margin-bottom: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">KABUL EDİLEN</div>
						<div style="font-size: 26px; font-weight: 700; margin-bottom: 8px;">${formatNumber(record.totalProductsAccepted)}</div>
						<div style="font-size: 10px; opacity: 0.85; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px; margin-top: 8px;">%${formatPercent(record.acceptanceRate)}</div>
					</div>
					<div style="background-color: #f59e0b; border-radius: 8px; padding: 24px; color: white; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-left: 4px solid #fbbf24;">
						<div style="font-size: 11px; opacity: 0.9; margin-bottom: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">ŞARTLI KABUL</div>
						<div style="font-size: 26px; font-weight: 700; margin-bottom: 8px;">${formatNumber(record.totalProductsConditional)}</div>
						<div style="font-size: 10px; opacity: 0.85; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px; margin-top: 8px;">%${formatPercent(record.conditionalRate)}</div>
					</div>
					<div style="background-color: #7c3aed; border-radius: 8px; padding: 24px; color: white; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-left: 4px solid #a78bfa;">
						<div style="font-size: 11px; opacity: 0.9; margin-bottom: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">AÇILAN DF SAYISI</div>
						<div style="font-size: 26px; font-weight: 700; margin-bottom: 8px;">${formatNumber(record.totalDFs)}</div>
						<div style="font-size: 10px; opacity: 0.85; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px; margin-top: 8px;">Düzeltici Faaliyet</div>
					</div>
				</div>
			`;

			// Karar Bazlı Analiz
			const decisionsHtml = `
				<div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 30px; border: 1px solid #e5e7eb;">
					<h3 style="font-size: 16px; font-weight: 700; color: #1e40af; margin-bottom: 15px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">Karar Bazlı Analiz</h3>
					<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px;">
						<div style="background-color: white; border-radius: 6px; padding: 18px; border-left: 4px solid #059669; border: 1px solid #e5e7eb;">
							<div style="font-size: 12px; color: #6b7280; margin-bottom: 8px; font-weight: 600;">Kabul</div>
							<div style="font-size: 20px; font-weight: 700; color: #1f2937; margin-bottom: 4px;">${formatNumber(record.decisions?.Kabul?.count || 0)}</div>
							<div style="font-size: 11px; color: #6b7280; margin-top: 4px;">${formatNumber(record.decisions?.Kabul?.quantity || 0)} adet</div>
						</div>
						<div style="background-color: white; border-radius: 6px; padding: 18px; border-left: 4px solid #f59e0b; border: 1px solid #e5e7eb;">
							<div style="font-size: 12px; color: #6b7280; margin-bottom: 8px; font-weight: 600;">Şartlı Kabul</div>
							<div style="font-size: 20px; font-weight: 700; color: #1f2937; margin-bottom: 4px;">${formatNumber(record.decisions?.['Şartlı Kabul']?.count || 0)}</div>
							<div style="font-size: 11px; color: #6b7280; margin-top: 4px;">${formatNumber(record.decisions?.['Şartlı Kabul']?.quantity || 0)} adet</div>
						</div>
						<div style="background-color: white; border-radius: 6px; padding: 18px; border-left: 4px solid #dc2626; border: 1px solid #e5e7eb;">
							<div style="font-size: 12px; color: #6b7280; margin-bottom: 8px; font-weight: 600;">Ret</div>
							<div style="font-size: 20px; font-weight: 700; color: #1f2937; margin-bottom: 4px;">${formatNumber(record.decisions?.Ret?.count || 0)}</div>
							<div style="font-size: 11px; color: #6b7280; margin-top: 4px;">${formatNumber(record.decisions?.Ret?.quantity || 0)} adet</div>
						</div>
						<div style="background-color: white; border-radius: 6px; padding: 18px; border-left: 4px solid #6b7280; border: 1px solid #e5e7eb;">
							<div style="font-size: 12px; color: #6b7280; margin-bottom: 8px; font-weight: 600;">Beklemede</div>
							<div style="font-size: 20px; font-weight: 700; color: #1f2937; margin-bottom: 4px;">${formatNumber(record.decisions?.Beklemede?.count || 0)}</div>
							<div style="font-size: 11px; color: #6b7280; margin-top: 4px;">${formatNumber(record.decisions?.Beklemede?.quantity || 0)} adet</div>
						</div>
					</div>
				</div>
			`;

			// En Çok Ret Veren Tedarikçiler Tablosu
			const topSuppliersHtml = record.topSuppliers && record.topSuppliers.length > 0
				? `
					<h3 style="font-size: 18px; font-weight: 700; color: #1e40af; margin-bottom: 15px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">En Çok Ret Veren Tedarikçiler (Top 10)</h3>
					<table class="info-table results-table" style="margin-bottom: 30px; width: 100%;">
						<thead>
							<tr style="background-color: #1e40af; color: white;">
								<th style="width: 5%; padding: 12px; text-align: center;">#</th>
								<th style="width: 30%; padding: 12px; text-align: left;">Tedarikçi</th>
								<th style="width: 12%; padding: 12px; text-align: center;">Kontrol Sayısı</th>
								<th style="width: 15%; padding: 12px; text-align: right;">Toplam Gelen</th>
								<th style="width: 15%; padding: 12px; text-align: right;">Ret Edilen</th>
								<th style="width: 12%; padding: 12px; text-align: right;">Ret Oranı</th>
								<th style="width: 11%; padding: 12px; text-align: center;">Açılan DF</th>
							</tr>
						</thead>
						<tbody>
							${record.topSuppliers.map((item, idx) => `
								<tr style="border-bottom: 1px solid #e5e7eb;">
									<td style="padding: 12px; text-align: center; font-weight: 600; color: #6b7280;">${idx + 1}</td>
									<td style="padding: 12px; font-weight: 600; color: #111827;">${item.name}</td>
									<td style="padding: 12px; text-align: center; color: #6b7280;">${formatNumber(item.count)}</td>
									<td style="padding: 12px; text-align: right; color: #059669; font-weight: 600;">${formatNumber(item.totalReceived)}</td>
									<td style="padding: 12px; text-align: right; font-weight: 700; color: #dc2626;">${formatNumber(item.totalRejected)}</td>
									<td style="padding: 12px; text-align: right; color: #dc2626; font-weight: 600;">%${formatPercent(item.rejectionRate)}</td>
									<td style="padding: 12px; text-align: center; color: #7c3aed; font-weight: 600;">${formatNumber(item.dfCount)}</td>
								</tr>
							`).join('')}
						</tbody>
					</table>
				`
				: '';

			// En Çok Ret Veren Parçalar Tablosu
			const topPartsHtml = record.topParts && record.topParts.length > 0
				? `
					<h3 style="font-size: 18px; font-weight: 700; color: #1e40af; margin-bottom: 15px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">En Çok Ret Veren Parçalar (Top 10)</h3>
					<table class="info-table results-table" style="margin-bottom: 30px; width: 100%;">
						<thead>
							<tr style="background-color: #1e40af; color: white;">
								<th style="width: 5%; padding: 12px; text-align: center;">#</th>
								<th style="width: 20%; padding: 12px; text-align: left;">Parça Kodu</th>
								<th style="width: 25%; padding: 12px; text-align: left;">Parça Adı</th>
								<th style="width: 12%; padding: 12px; text-align: center;">Kontrol Sayısı</th>
								<th style="width: 15%; padding: 12px; text-align: right;">Toplam Gelen</th>
								<th style="width: 15%; padding: 12px; text-align: right;">Ret Edilen</th>
								<th style="width: 8%; padding: 12px; text-align: right;">Ret Oranı</th>
							</tr>
						</thead>
						<tbody>
							${record.topParts.map((item, idx) => `
								<tr style="border-bottom: 1px solid #e5e7eb;">
									<td style="padding: 12px; text-align: center; font-weight: 600; color: #6b7280;">${idx + 1}</td>
									<td style="padding: 12px; font-weight: 600; color: #111827; font-family: monospace;">${item.partCode}</td>
									<td style="padding: 12px; color: #6b7280;">${item.partName}</td>
									<td style="padding: 12px; text-align: center; color: #6b7280;">${formatNumber(item.count)}</td>
									<td style="padding: 12px; text-align: right; color: #059669; font-weight: 600;">${formatNumber(item.totalReceived)}</td>
									<td style="padding: 12px; text-align: right; font-weight: 700; color: #dc2626;">${formatNumber(item.totalRejected)}</td>
									<td style="padding: 12px; text-align: right; color: #dc2626; font-weight: 600;">%${formatPercent(item.rejectionRate)}</td>
								</tr>
							`).join('')}
						</tbody>
					</table>
				`
				: '';

			// Ret Veren Tedarikçiler ve DF Analizi
			const rejectedSuppliersHtml = record.rejectedSuppliers && record.rejectedSuppliers.length > 0
				? `
					<h3 style="font-size: 18px; font-weight: 700; color: #1e40af; margin-bottom: 15px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">Ret Veren Tedarikçiler ve DF Analizi (Top 10)</h3>
					<table class="info-table results-table" style="margin-bottom: 30px; width: 100%;">
						<thead>
							<tr style="background-color: #dc2626; color: white;">
								<th style="width: 5%; padding: 12px; text-align: center;">#</th>
								<th style="width: 40%; padding: 12px; text-align: left;">Tedarikçi</th>
								<th style="width: 20%; padding: 12px; text-align: center;">Ret Kayıt Sayısı</th>
								<th style="width: 20%; padding: 12px; text-align: right;">Toplam Ret Miktarı</th>
								<th style="width: 15%; padding: 12px; text-align: center;">Açılan DF</th>
							</tr>
						</thead>
						<tbody>
							${record.rejectedSuppliers.map((item, idx) => `
								<tr style="border-bottom: 1px solid #e5e7eb;">
									<td style="padding: 12px; text-align: center; font-weight: 600; color: #6b7280;">${idx + 1}</td>
									<td style="padding: 12px; font-weight: 600; color: #111827;">${item.name}</td>
									<td style="padding: 12px; text-align: center; color: #6b7280;">${formatNumber(item.rejectionCount)}</td>
									<td style="padding: 12px; text-align: right; font-weight: 700; color: #dc2626;">${formatNumber(item.totalRejected)}</td>
									<td style="padding: 12px; text-align: center; color: #7c3aed; font-weight: 600;">${formatNumber(item.dfCount)}</td>
								</tr>
							`).join('')}
						</tbody>
					</table>
				`
				: '';

			// Aylık Trend Analizi Tablosu
			const monthlyTrendHtml = record.monthlyData && record.monthlyData.length > 0
				? `
					<h3 style="font-size: 18px; font-weight: 700; color: #1e40af; margin-bottom: 15px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">Aylık Trend Analizi (Son 12 Ay)</h3>
					<table class="info-table results-table" style="margin-bottom: 30px; width: 100%;">
						<thead>
							<tr style="background-color: #10b981; color: white;">
								<th style="width: 20%; padding: 12px; text-align: left;">Ay</th>
								<th style="width: 15%; padding: 12px; text-align: center;">Kontrol Sayısı</th>
								<th style="width: 20%; padding: 12px; text-align: right;">Toplam Gelen</th>
								<th style="width: 20%; padding: 12px; text-align: right;">Ret Edilen</th>
								<th style="width: 15%; padding: 12px; text-align: right;">Ret Oranı</th>
								<th style="width: 10%; padding: 12px; text-align: right;">Şartlı Kabul</th>
							</tr>
						</thead>
						<tbody>
							${record.monthlyData.map((item, idx) => `
								<tr style="border-bottom: 1px solid #e5e7eb;">
									<td style="padding: 12px; font-weight: 600; color: #111827;">${item.month}</td>
									<td style="padding: 12px; text-align: center; color: #6b7280;">${formatNumber(item.count)}</td>
									<td style="padding: 12px; text-align: right; color: #059669; font-weight: 600;">${formatNumber(item.totalReceived)}</td>
									<td style="padding: 12px; text-align: right; font-weight: 700; color: #dc2626;">${formatNumber(item.totalRejected)}</td>
									<td style="padding: 12px; text-align: right; color: #dc2626; font-weight: 600;">%${formatPercent(item.rejectionRate)}</td>
									<td style="padding: 12px; text-align: right; color: #f59e0b; font-weight: 600;">${formatNumber(item.totalConditional)}</td>
								</tr>
							`).join('')}
						</tbody>
					</table>
				`
				: '';

			summaryHtml = `
				<div style="margin-bottom: 25px;">
					<p style="font-size: 14px; color: #6b7280; margin-bottom: 5px;"><strong>Rapor Tarihi:</strong> ${record.reportDate || formatDateLocal(new Date().toISOString())}</p>
					<p style="font-size: 14px; color: #6b7280; margin-bottom: 5px;"><strong>Dönem:</strong> ${periodInfo}</p>
					<p style="font-size: 14px; color: #6b7280;"><strong>Toplam Muayene Sayısı:</strong> ${formatNumber(record.totalInspections)}</p>
				</div>
				${summaryCardsHtml}
				${decisionsHtml}
				${topSuppliersHtml}
				${topPartsHtml}
				${rejectedSuppliersHtml}
				${monthlyTrendHtml}
			`;

			// Bu rapor için tablo gerekmediği için boş bırakıyoruz
			headers = [];
			rowsHtml = '';
		}
	} else if (type === 'supplier_quality_executive_summary') {
		title = 'Tedarikçi Kalite Yönetimi Yönetici Özeti Raporu';

		// Veri kontrolü
		if (!record || typeof record !== 'object') {
			summaryHtml = '<p style="color: #dc2626; font-weight: 600;">Rapor verisi bulunamadı. Lütfen tekrar deneyin.</p>';
			headers = [];
			rowsHtml = '';
		} else {
			const formatNumber = (value) => (value || 0).toLocaleString('tr-TR');
			const formatPercent = (value) => (value || 0).toFixed(2);
			const formatDateLocal = (dateStr) => formatDateHelper(dateStr, 'dd.MM.yyyy');

			// Genel Özet Kartları
			const summaryCardsHtml = `
				<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px;">
					<div style="background-color: #1e40af; border-radius: 8px; padding: 24px; color: white; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-left: 4px solid #3b82f6;">
						<div style="font-size: 11px; opacity: 0.9; margin-bottom: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">TOPLAM TEDARİKÇİ</div>
						<div style="font-size: 26px; font-weight: 700; margin-bottom: 8px;">${formatNumber(record.totalSuppliers)}</div>
						<div style="font-size: 10px; opacity: 0.85; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px; margin-top: 8px;">Kayıtlı tedarikçi</div>
					</div>
					<div style="background-color: #059669; border-radius: 8px; padding: 24px; color: white; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-left: 4px solid #10b981;">
						<div style="font-size: 11px; opacity: 0.9; margin-bottom: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">ONAYLI TEDARİKÇİ</div>
						<div style="font-size: 26px; font-weight: 700; margin-bottom: 8px;">${formatNumber(record.approvedSuppliers)}</div>
						<div style="font-size: 10px; opacity: 0.85; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px; margin-top: 8px;">%${formatPercent((record.approvedSuppliers / record.totalSuppliers) * 100)}</div>
					</div>
					<div style="background-color: #dc2626; border-radius: 8px; padding: 24px; color: white; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-left: 4px solid #ef4444;">
						<div style="font-size: 11px; opacity: 0.9; margin-bottom: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">AÇIK UYGUNSUZLUK</div>
						<div style="font-size: 26px; font-weight: 700; margin-bottom: 8px;">${formatNumber(record.openNCs)}</div>
						<div style="font-size: 10px; opacity: 0.85; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px; margin-top: 8px;">Toplam: ${formatNumber(record.totalNCs)}</div>
					</div>
				</div>
				<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px;">
					<div style="background-color: #2563eb; border-radius: 8px; padding: 24px; color: white; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-left: 4px solid #60a5fa;">
						<div style="font-size: 11px; opacity: 0.9; margin-bottom: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">TAMAMLANAN DENETİM</div>
						<div style="font-size: 26px; font-weight: 700; margin-bottom: 8px;">${formatNumber(record.completedAudits)}</div>
						<div style="font-size: 10px; opacity: 0.85; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px; margin-top: 8px;">Ortalama Skor: ${formatNumber(record.averageAuditScore)}</div>
					</div>
					<div style="background-color: #f59e0b; border-radius: 8px; padding: 24px; color: white; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-left: 4px solid #fbbf24;">
						<div style="font-size: 11px; opacity: 0.9; margin-bottom: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">SERTİFİKA YAKLAŞAN</div>
						<div style="font-size: 26px; font-weight: 700; margin-bottom: 8px;">${formatNumber(record.expiringCerts)}</div>
						<div style="font-size: 10px; opacity: 0.85; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px; margin-top: 8px;">Süresi Dolan: ${formatNumber(record.expiredCerts)}</div>
					</div>
					<div style="background-color: #7c3aed; border-radius: 8px; padding: 24px; color: white; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-left: 4px solid #a78bfa;">
						<div style="font-size: 11px; opacity: 0.9; margin-bottom: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">GENEL PPM</div>
						<div style="font-size: 26px; font-weight: 700; margin-bottom: 8px;">${formatNumber(record.overallPPM)}</div>
						<div style="font-size: 10px; opacity: 0.85; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px; margin-top: 8px;">Parts Per Million</div>
					</div>
				</div>
			`;

			// En Çok Uygunsuzluk Olan Tedarikçiler Tablosu
			const topNCSuppliersHtml = record.topNCSuppliers && record.topNCSuppliers.length > 0
				? `
					<h3 style="font-size: 18px; font-weight: 700; color: #1e40af; margin-bottom: 15px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">En Çok Uygunsuzluk Olan Tedarikçiler (Top 10)</h3>
					<table class="info-table results-table" style="margin-bottom: 30px; width: 100%;">
						<thead>
							<tr style="background-color: #dc2626; color: white;">
								<th style="width: 5%; padding: 12px; text-align: center;">#</th>
								<th style="width: 40%; padding: 12px; text-align: left;">Tedarikçi</th>
								<th style="width: 15%; padding: 12px; text-align: center;">Toplam Uygunsuzluk</th>
								<th style="width: 15%; padding: 12px; text-align: center;">Açık</th>
								<th style="width: 15%; padding: 12px; text-align: center;">Kapatıldı</th>
							</tr>
						</thead>
						<tbody>
							${record.topNCSuppliers.map((item, idx) => `
								<tr style="border-bottom: 1px solid #e5e7eb;">
									<td style="padding: 12px; text-align: center; font-weight: 600; color: #6b7280;">${idx + 1}</td>
									<td style="padding: 12px; font-weight: 600; color: #111827;">${item.supplierName}</td>
									<td style="padding: 12px; text-align: center; font-weight: 700; color: #dc2626;">${formatNumber(item.totalNCs)}</td>
									<td style="padding: 12px; text-align: center; color: #f59e0b; font-weight: 600;">${formatNumber(item.openNCs)}</td>
									<td style="padding: 12px; text-align: center; color: #059669; font-weight: 600;">${formatNumber(item.closedNCs)}</td>
								</tr>
							`).join('')}
						</tbody>
					</table>
				`
				: '';

			// En Düşük Skorlu Tedarikçiler Tablosu
			const topLowScoreSuppliersHtml = record.topLowScoreSuppliers && record.topLowScoreSuppliers.length > 0
				? `
					<h3 style="font-size: 18px; font-weight: 700; color: #1e40af; margin-bottom: 15px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">En Düşük Skorlu Tedarikçiler (Top 10)</h3>
					<table class="info-table results-table" style="margin-bottom: 30px; width: 100%;">
						<thead>
							<tr style="background-color: #f59e0b; color: white;">
								<th style="width: 5%; padding: 12px; text-align: center;">#</th>
								<th style="width: 50%; padding: 12px; text-align: left;">Tedarikçi</th>
								<th style="width: 20%; padding: 12px; text-align: center;">Denetim Skoru</th>
								<th style="width: 25%; padding: 12px; text-align: center;">Sınıf</th>
							</tr>
						</thead>
						<tbody>
							${record.topLowScoreSuppliers.map((item, idx) => {
					const gradeColor = item.grade === 'A' ? '#059669' : item.grade === 'B' ? '#2563eb' : item.grade === 'C' ? '#f59e0b' : '#dc2626';
					const gradeLabel = item.grade === 'A' ? 'A - Stratejik İş Ortağı' : item.grade === 'B' ? 'B - Güvenilir Tedarikçi' : item.grade === 'C' ? 'C - İzlemeye Alınacak' : 'D - İş Birliği Sonlandırılacak';
					return `
									<tr style="border-bottom: 1px solid #e5e7eb;">
										<td style="padding: 12px; text-align: center; font-weight: 600; color: #6b7280;">${idx + 1}</td>
										<td style="padding: 12px; font-weight: 600; color: #111827;">${item.name}</td>
										<td style="padding: 12px; text-align: center; font-weight: 700; color: ${gradeColor};">${formatNumber(item.score)}</td>
										<td style="padding: 12px; text-align: center; color: ${gradeColor}; font-weight: 600;">${gradeLabel}</td>
									</tr>
								`;
				}).join('')}
						</tbody>
					</table>
				`
				: '';

			// En Yüksek PPM Tedarikçiler Tablosu
			const supplierPPMHtml = record.supplierPPM && record.supplierPPM.length > 0
				? `
					<h3 style="font-size: 18px; font-weight: 700; color: #1e40af; margin-bottom: 15px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">En Yüksek PPM Tedarikçiler (Top 10)</h3>
					<table class="info-table results-table" style="margin-bottom: 30px; width: 100%;">
						<thead>
							<tr style="background-color: #7c3aed; color: white;">
								<th style="width: 5%; padding: 12px; text-align: center;">#</th>
								<th style="width: 40%; padding: 12px; text-align: left;">Tedarikçi</th>
								<th style="width: 15%; padding: 12px; text-align: right;">PPM</th>
								<th style="width: 20%; padding: 12px; text-align: right;">Muayene Edilen</th>
								<th style="width: 20%; padding: 12px; text-align: right;">Hatalı</th>
							</tr>
						</thead>
						<tbody>
							${record.supplierPPM.map((item, idx) => `
								<tr style="border-bottom: 1px solid #e5e7eb;">
									<td style="padding: 12px; text-align: center; font-weight: 600; color: #6b7280;">${idx + 1}</td>
									<td style="padding: 12px; font-weight: 600; color: #111827;">${item.supplierName}</td>
									<td style="padding: 12px; text-align: right; font-weight: 700; color: #dc2626;">${formatNumber(item.ppm)}</td>
									<td style="padding: 12px; text-align: right; color: #059669; font-weight: 600;">${formatNumber(item.inspected)}</td>
									<td style="padding: 12px; text-align: right; color: #dc2626; font-weight: 600;">${formatNumber(item.defective)}</td>
								</tr>
							`).join('')}
						</tbody>
					</table>
				`
				: '';

			// DF Açılan Tedarikçiler Tablosu
			const topDFSuppliersHtml = record.topDFSuppliers && record.topDFSuppliers.length > 0
				? `
					<h3 style="font-size: 18px; font-weight: 700; color: #1e40af; margin-bottom: 15px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">DF Açılan Tedarikçiler (Top 10)</h3>
					<table class="info-table results-table" style="margin-bottom: 30px; width: 100%;">
						<thead>
							<tr style="background-color: #dc2626; color: white;">
								<th style="width: 5%; padding: 12px; text-align: center;">#</th>
								<th style="width: 50%; padding: 12px; text-align: left;">Tedarikçi</th>
								<th style="width: 20%; padding: 12px; text-align: center;">Toplam DF</th>
								<th style="width: 25%; padding: 12px; text-align: center;">Açık DF</th>
							</tr>
						</thead>
						<tbody>
							${record.topDFSuppliers.map((item, idx) => `
								<tr style="border-bottom: 1px solid #e5e7eb;">
									<td style="padding: 12px; text-align: center; font-weight: 600; color: #6b7280;">${idx + 1}</td>
									<td style="padding: 12px; font-weight: 600; color: #111827;">${item.supplierName}</td>
									<td style="padding: 12px; text-align: center; font-weight: 700; color: #dc2626;">${formatNumber(item.dfCount)}</td>
									<td style="padding: 12px; text-align: center; color: #f59e0b; font-weight: 600;">${formatNumber(item.openDFs)}</td>
								</tr>
							`).join('')}
						</tbody>
					</table>
				`
				: '';

			// Tedarikçi Puan Dağılımı (dashboard'dan entegre)
			const gradeDistributionHtml = record.gradeDistribution && record.gradeDistribution.length > 0
				? `
					<h3 style="font-size: 18px; font-weight: 700; color: #1e40af; margin-bottom: 15px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">Tedarikçi Puan Dağılımı</h3>
					<table class="info-table results-table" style="margin-bottom: 30px; width: 100%;">
						<thead>
							<tr style="background-color: #7c3aed; color: white;">
								<th style="width: 40%; padding: 12px; text-align: left;">Sınıf</th>
								<th style="width: 30%; padding: 12px; text-align: center;">Tedarikçi Sayısı</th>
								<th style="width: 30%; padding: 12px; text-align: center;">Oran</th>
							</tr>
						</thead>
						<tbody>
							${record.gradeDistribution.map((entry, idx) => {
								const total = record.gradeDistribution.reduce((s, e) => s + (e.value || 0), 0);
								const pct = total > 0 ? ((entry.value || 0) / total * 100).toFixed(1) : '0';
								const colors = { 'A': '#22c55e', 'B': '#3b82f6', 'C': '#eab308', 'D': '#ef4444', 'N/A': '#9ca3af' };
								return `
									<tr style="border-bottom: 1px solid #e5e7eb;">
										<td style="padding: 12px; font-weight: 600; color: ${colors[entry.name] || '#374151'};">${entry.label || entry.name}</td>
										<td style="padding: 12px; text-align: center; font-weight: 600;">${formatNumber(entry.value)}</td>
										<td style="padding: 12px; text-align: center;">%${pct}</td>
									</tr>
								`;
							}).join('')}
						</tbody>
					</table>
				`
				: '';

			// Tedarikçi Listesi (liste raporundan entegre)
			const supplierListTableHtml = record.suppliers && record.suppliers.length > 0
				? `
					<h3 style="font-size: 18px; font-weight: 700; color: #1e40af; margin-bottom: 15px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">Tedarikçi Listesi (${record.totalCount || record.suppliers.length} Kayıt)</h3>
					<table class="info-table results-table" style="margin-bottom: 30px; width: 100%; font-size: 0.85em;">
						<thead>
							<tr style="background-color: #1e40af; color: white;">
								<th style="width: 4%; padding: 10px; text-align: center;">#</th>
								<th style="width: 18%; padding: 10px; text-align: left;">Tedarikçi</th>
								<th style="width: 12%; padding: 10px; text-align: left;">Ürün Grubu</th>
								<th style="width: 10%; padding: 10px; text-align: center;">Durum</th>
								<th style="width: 12%; padding: 10px; text-align: center;">Puan/Sınıf</th>
								<th style="width: 18%; padding: 10px; text-align: left;">Ana Tedarikçi</th>
								<th style="width: 18%; padding: 10px; text-align: left;">Alternatifler</th>
								<th style="width: 8%; padding: 10px; text-align: left;">İletişim</th>
							</tr>
						</thead>
						<tbody>
							${record.suppliers.map((supplier, idx) => {
								const statusBadge = supplier.status === 'Onaylı'
									? '<span style="padding: 2px 6px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #d1fae5; color: #065f46;">Onaylı</span>'
									: supplier.status === 'Alternatif'
										? '<span style="padding: 2px 6px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #dbeafe; color: #1e40af;">Alternatif</span>'
										: supplier.status === 'Askıya Alınmış'
											? '<span style="padding: 2px 6px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #fee2e2; color: #991b1b;">Askıya Alınmış</span>'
											: supplier.status === 'Red'
												? '<span style="padding: 2px 6px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #fee2e2; color: #991b1b;">Reddedildi</span>'
												: '<span style="padding: 2px 6px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #e5e7eb; color: #374151;">' + (supplier.status || '-') + '</span>';
								const gradeInfo = supplier.gradeInfo || {};
								const gradeBadge = gradeInfo.grade === 'A'
									? '<span style="padding: 2px 6px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #d1fae5; color: #065f46;">A</span>'
									: gradeInfo.grade === 'B'
										? '<span style="padding: 2px 6px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #dbeafe; color: #1e40af;">B</span>'
										: gradeInfo.grade === 'C'
											? '<span style="padding: 2px 6px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #fef3c7; color: #92400e;">C</span>'
											: gradeInfo.grade === 'D'
												? '<span style="padding: 2px 6px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #fee2e2; color: #991b1b;">D</span>'
												: '<span style="padding: 2px 6px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #e5e7eb; color: #374151;">N/A</span>';
								const mainSupplier = supplier.alternativeSupplier ? supplier.alternativeSupplier.name : '-';
								const alternatives = supplier.alternativeSuppliers && supplier.alternativeSuppliers.length > 0
									? supplier.alternativeSuppliers.map(alt => alt.name).join(', ')
									: '-';
								return `
									<tr style="border-bottom: 1px solid #e5e7eb;">
										<td style="padding: 10px; text-align: center; font-weight: 600;">${supplier.serialNumber || (idx + 1)}</td>
										<td style="padding: 10px; font-weight: 600;">${supplier.name || '-'}</td>
										<td style="padding: 10px;">${supplier.product_group || '-'}</td>
										<td style="padding: 10px;">${statusBadge}</td>
										<td style="padding: 10px;">${gradeBadge}</td>
										<td style="padding: 10px;">${mainSupplier}</td>
										<td style="padding: 10px;">${alternatives}</td>
										<td style="padding: 10px; font-size: 0.8em;">${supplier.email || supplier.phone || '-'}</td>
									</tr>
								`;
							}).join('')}
						</tbody>
					</table>
				`
				: '';

			summaryHtml = `
				<div style="margin-bottom: 25px;">
					<p style="font-size: 14px; color: #6b7280; margin-bottom: 5px;"><strong>Rapor Tarihi:</strong> ${record.reportDate || formatDateLocal(new Date().toISOString())}</p>
					<p style="font-size: 14px; color: #6b7280; margin-bottom: 5px;"><strong>Toplam Tedarikçi:</strong> ${formatNumber(record.totalSuppliers)}</p>
					<p style="font-size: 14px; color: #6b7280;"><strong>Onaylı Tedarikçi:</strong> ${formatNumber(record.approvedSuppliers)} | Alternatif: ${formatNumber(record.alternativeSuppliers)} | Askıya Alınmış: ${formatNumber(record.suspendedSuppliers)} | Reddedildi: ${formatNumber(record.rejectedSuppliers)}</p>
				</div>
				${summaryCardsHtml}
				${topNCSuppliersHtml}
				${topLowScoreSuppliersHtml}
				${supplierPPMHtml}
				${topDFSuppliersHtml}
				${gradeDistributionHtml}
				${supplierListTableHtml}
			`;

			headers = [];
			rowsHtml = '';
		}
	} else if (type === 'supplier_list') {
		title = record.title || 'Tedarikçi Listesi Raporu';
		headers = ['S.No', 'Tedarikçi Adı', 'Ürün Grubu', 'Durum', 'Puan / Sınıf', 'Ana Tedarikçi', 'Alternatif Tedarikçiler', 'İletişim'];

		rowsHtml = (record.suppliers || []).map((supplier, idx) => {
			const statusBadge = supplier.status === 'Onaylı'
				? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #d1fae5; color: #065f46;">Onaylı</span>'
				: supplier.status === 'Alternatif'
					? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #dbeafe; color: #1e40af;">Alternatif</span>'
					: supplier.status === 'Askıya Alınmış'
						? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #fee2e2; color: #991b1b;">Askıya Alınmış</span>'
						: supplier.status === 'Red'
							? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #fee2e2; color: #991b1b;">Reddedildi</span>'
							: '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #e5e7eb; color: #374151;">' + (supplier.status || '-') + '</span>';

			const gradeInfo = supplier.gradeInfo || {};
			const gradeBadge = gradeInfo.grade === 'A'
				? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #d1fae5; color: #065f46;">A-Stratejik</span>'
				: gradeInfo.grade === 'B'
					? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #dbeafe; color: #1e40af;">B-Güvenilir</span>'
					: gradeInfo.grade === 'C'
						? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #fef3c7; color: #92400e;">C-İzlenecek</span>'
						: gradeInfo.grade === 'D'
							? '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #fee2e2; color: #991b1b;">D-Riskli</span>'
							: '<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #e5e7eb; color: #374151;">N/A</span>';

			const mainSupplier = supplier.alternativeSupplier ? supplier.alternativeSupplier.name : '-';
			const alternatives = supplier.alternativeSuppliers && supplier.alternativeSuppliers.length > 0
				? supplier.alternativeSuppliers.map(alt => alt.name).join(', ')
				: '-';

			return `
				<tr>
					<td style="width: 5%; text-align: center; font-weight: 600;">${supplier.serialNumber || (idx + 1)}</td>
					<td style="width: 20%; font-weight: 600;">${supplier.name || '-'}</td>
					<td style="width: 15%; font-size: 0.85em;">${supplier.product_group || '-'}</td>
					<td style="width: 12%;">${statusBadge}</td>
					<td style="width: 15%;">${gradeBadge}</td>
					<td style="width: 15%; font-size: 0.85em;">${mainSupplier}</td>
					<td style="width: 13%; font-size: 0.85em;">${alternatives}</td>
					<td style="width: 5%; font-size: 0.8em;">${supplier.email || supplier.phone || '-'}</td>
				</tr>
			`;
		}).join('');

		const statusCounts = (record.suppliers || []).reduce((acc, s) => {
			acc[s.status] = (acc[s.status] || 0) + 1;
			return acc;
		}, {});
		const statusSummary = Object.entries(statusCounts)
			.map(([status, count]) => `<span style="margin-right: 15px;"><strong>${status}:</strong> ${count}</span>`)
			.join('');

		summaryHtml = `
			<p><strong>Toplam Tedarikçi Sayısı:</strong> ${record.totalCount || 0}</p>
			<p><strong>Onaylı Tedarikçi:</strong> ${record.approvedCount || 0}</p>
			<p><strong>Alternatif Tedarikçi:</strong> ${record.alternativeCount || 0}</p>
			${statusSummary ? `<p><strong>Durum Dağılımı:</strong> ${statusSummary}</p>` : ''}
		`;
	} else if (type === 'supplier_dashboard') {
		title = record.title || 'Tedarikçi Kalite Genel Bakış Raporu';

		const dashboardData = record.dashboardData || {};
		const statsHtml = `
			<div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px; margin-bottom: 25px;">
				<div style="background-color: #dbeafe; border: 2px solid #3b82f6; border-radius: 8px; padding: 15px; text-align: center;">
					<div style="font-size: 11px; color: #1e40af; font-weight: 600; margin-bottom: 5px;">TOPLAM TEDARİKÇİ</div>
					<div style="font-size: 24px; font-weight: 700; color: #1e40af;">${dashboardData.totalSuppliers || 0}</div>
				</div>
				<div style="background-color: #d1fae5; border: 2px solid #10b981; border-radius: 8px; padding: 15px; text-align: center;">
					<div style="font-size: 11px; color: #065f46; font-weight: 600; margin-bottom: 5px;">ONAYLI</div>
					<div style="font-size: 24px; font-weight: 700; color: #065f46;">${dashboardData.approvedSuppliers || 0}</div>
				</div>
				<div style="background-color: #fee2e2; border: 2px solid #ef4444; border-radius: 8px; padding: 15px; text-align: center;">
					<div style="font-size: 11px; color: #991b1b; font-weight: 600; margin-bottom: 5px;">AÇIK UYGUNSUZLUK</div>
					<div style="font-size: 24px; font-weight: 700; color: #991b1b;">${dashboardData.openNCs || 0}</div>
				</div>
				<div style="background-color: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 15px; text-align: center;">
					<div style="font-size: 11px; color: #92400e; font-weight: 600; margin-bottom: 5px;">SERTİFİKA YAKLAŞAN</div>
					<div style="font-size: 24px; font-weight: 700; color: #92400e;">${dashboardData.expiringCerts || 0}</div>
				</div>
				<div style="background-color: #e9d5ff; border: 2px solid #9333ea; border-radius: 8px; padding: 15px; text-align: center;">
					<div style="font-size: 11px; color: #6b21a8; font-weight: 600; margin-bottom: 5px;">GENEL PPM</div>
					<div style="font-size: 24px; font-weight: 700; color: #6b21a8;">${(dashboardData.overallPPM || 0).toLocaleString()}</div>
				</div>
			</div>
		`;

		const supplierPPMHtml = dashboardData.supplierPPM && dashboardData.supplierPPM.length > 0
			? `
				<h3 style="font-size: 16px; font-weight: 600; color: #1e40af; margin-bottom: 15px; border-bottom: 2px solid #bfdbfe; padding-bottom: 5px;">Tedarikçi Bazlı PPM (En Yüksek 10)</h3>
				<table class="info-table results-table" style="margin-bottom: 25px;">
					<thead>
						<tr>
							<th style="width: 60%;">Tedarikçi</th>
							<th style="width: 15%; text-align: right;">PPM</th>
							<th style="width: 12%; text-align: right;">Muayene</th>
							<th style="width: 13%; text-align: right;">Hatalı</th>
						</tr>
					</thead>
					<tbody>
						${dashboardData.supplierPPM.map(s => `
							<tr>
								<td style="font-weight: 600;">${s.name}</td>
								<td style="text-align: right; font-weight: 700; color: #dc2626;">${s.ppm.toLocaleString()}</td>
								<td style="text-align: right;">${s.inspected.toLocaleString()}</td>
								<td style="text-align: right;">${s.defective.toLocaleString()}</td>
							</tr>
						`).join('')}
					</tbody>
				</table>
			`
			: '<p style="color: #6b7280; font-style: italic; margin-bottom: 25px;">Seçili dönem için PPM verisi bulunmamaktadır.</p>';

		const gradeDistributionHtml = dashboardData.gradeDistribution && dashboardData.gradeDistribution.length > 0
			? `
				<h3 style="font-size: 16px; font-weight: 600; color: #1e40af; margin-bottom: 15px; border-bottom: 2px solid #bfdbfe; padding-bottom: 5px;">Tedarikçi Puan Dağılımı</h3>
				<table class="info-table results-table" style="margin-bottom: 25px;">
					<thead>
						<tr>
							<th style="width: 50%;">Sınıf</th>
							<th style="width: 25%; text-align: right;">Tedarikçi Sayısı</th>
							<th style="width: 25%; text-align: right;">Yüzde</th>
						</tr>
					</thead>
					<tbody>
						${dashboardData.gradeDistribution.map(g => {
				const total = dashboardData.totalSuppliers || 1;
				const percentage = ((g.value / total) * 100).toFixed(1);
				const color = g.name === 'A' ? '#d1fae5' : g.name === 'B' ? '#dbeafe' : g.name === 'C' ? '#fef3c7' : g.name === 'D' ? '#fee2e2' : '#e5e7eb';
				return `
								<tr style="background-color: ${color};">
									<td style="font-weight: 600;">${g.label}</td>
									<td style="text-align: right; font-weight: 700;">${g.value}</td>
									<td style="text-align: right;">%${percentage}</td>
								</tr>
							`;
			}).join('')}
					</tbody>
				</table>
			`
			: '';

		const upcomingAuditsHtml = dashboardData.upcomingAudits && dashboardData.upcomingAudits.length > 0
			? `
				<h3 style="font-size: 16px; font-weight: 600; color: #1e40af; margin-bottom: 15px; border-bottom: 2px solid #bfdbfe; padding-bottom: 5px;">Yaklaşan Denetimler (30 Gün)</h3>
				<table class="info-table results-table" style="margin-bottom: 25px;">
					<thead>
						<tr>
							<th style="width: 70%;">Tedarikçi</th>
							<th style="width: 30%; text-align: center;">Planlanan Tarih</th>
						</tr>
					</thead>
					<tbody>
						${dashboardData.upcomingAudits.map(audit => `
							<tr>
								<td style="font-weight: 600;">${audit.supplierName}</td>
								<td style="text-align: center;">${formatDate(audit.planned_date)}</td>
							</tr>
						`).join('')}
					</tbody>
				</table>
			`
			: '<p style="color: #6b7280; font-style: italic; margin-bottom: 25px;">Yaklaşan denetim bulunmuyor.</p>';

		const auditRecommendationsHtml = dashboardData.auditRecommendations && dashboardData.auditRecommendations.length > 0
			? `
				<h3 style="font-size: 16px; font-weight: 600; color: #f59e0b; margin-bottom: 15px; border-bottom: 2px solid #fcd34d; padding-bottom: 5px;">Akıllı Tavsiyeler: Denetim Gereken Tedarikçiler</h3>
				<table class="info-table results-table" style="margin-bottom: 25px;">
					<thead>
						<tr>
							<th style="width: 60%;">Tedarikçi</th>
							<th style="width: 20%; text-align: right;">PPM</th>
							<th style="width: 20%; text-align: center;">Durum</th>
						</tr>
					</thead>
					<tbody>
						${dashboardData.auditRecommendations.map(rec => `
							<tr>
								<td style="font-weight: 600;">${rec.name}</td>
								<td style="text-align: right; font-weight: 700; color: #dc2626;">${rec.ppm.toLocaleString()}</td>
								<td style="text-align: center;">
									<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; background-color: #fee2e2; color: #991b1b;">Denetim Gerekli</span>
								</td>
							</tr>
						`).join('')}
					</tbody>
				</table>
			`
			: '<p style="color: #10b981; font-weight: 600; text-align: center; padding: 20px; margin-bottom: 25px;">✓ Şu anda acil denetim gerektiren bir tedarikçi bulunmuyor. Harika iş!</p>';

		summaryHtml = `
			${statsHtml}
			${supplierPPMHtml}
			${gradeDistributionHtml}
			${upcomingAuditsHtml}
			${auditRecommendationsHtml}
			<p style="margin-top: 20px;"><strong>Filtre:</strong> ${record.filterDescription || 'Tüm Zamanlar'}</p>
		`;

		headers = [];
		rowsHtml = '';
	}

	// Logo base64 - public klasöründeki logo.png dosyasını kullan
	const localLogoUrl = getLogoUrl('logo.png');
	const mainLogoBase64 = logoCache[localLogoUrl] || localLogoUrl;

	// Rapor numarası oluştur
	const reportNo = type === 'produced_vehicles_executive_summary'
		? `ARAC-YONETICI-${formatDate(new Date()).replace(/\./g, '')}-${Date.now().toString().slice(-6)}`
		: type === 'incoming_quality_executive_summary'
			? `GIRDI-YONETICI-${formatDate(new Date()).replace(/\./g, '')}-${Date.now().toString().slice(-6)}`
			: type === 'supplier_quality_executive_summary'
				? `TEDARIKCI-YONETICI-${formatDate(new Date()).replace(/\./g, '')}-${Date.now().toString().slice(-6)}`
				: type === 'quality_cost_executive_summary'
					? `MALIYET-YONETICI${record.unit ? `-${record.unit.replace(/\s+/g, '_').toUpperCase()}` : ''}-${formatDate(new Date()).replace(/\./g, '')}-${Date.now().toString().slice(-6)}`
					: type === 'quality_cost_detail'
						? `MALIYET-DETAY-${formatDate(new Date()).replace(/\./g, '')}-${Date.now().toString().slice(-6)}`
						: `RAPOR-${formatDate(new Date()).replace(/\./g, '')}-${Date.now().toString().slice(-6)}`;

	return `
		<div class="report-header">
			<div class="report-logo">
				<img src="${mainLogoBase64}" alt="Kademe Logo">
			</div>
			<div class="company-title">
				<h1>KADEME A.Ş.</h1>
				<p>Kalite Yönetim Sistemi</p>
			</div>
			<div class="print-info">
				<div class="report-no">Rapor No</div>
				<div class="report-id">${reportNo}</div>
				<div class="report-date">${formatDateTime(new Date())}</div>
			</div>
		</div>

		<div class="meta-box meta-box-header">
			<div class="meta-item"><strong>Belge Türü:</strong> ${title}</div>
			<div class="meta-item"><strong>Rapor No:</strong> ${reportNo}</div>
		</div>

		<div class="section">
			<h2 class="section-title section-title-strip blue" style="word-wrap: break-word; word-break: break-word; line-height: 1.4; white-space: normal;">${title}</h2>
			<div class="list-summary">${summaryHtml}</div>
			${headers.length > 0 ? `
			<table class="info-table results-table">
				<thead>
					<tr>
						${headers.map(h => `<th>${h}</th>`).join('')}
					</tr>
				</thead>
				<tbody>
					${rowsHtml}
				</tbody>
			</table>
			` : ''}
		</div>

		 <div class="section signature-section">
			<h2 class="section-title section-title-strip dark">İMZA VE ONAY</h2>
			<div class="signature-area">
				<div class="signature-box">
					<p class="role">HAZIRLAYAN</p>
					<div class="signature-line"></div>
					<p class="name">Atakan BATTAL</p>
				</div>
			</div>
		</div>
	`;
};

const generateManagedNonconformityDetailHtml = (record) => {
	const formatDate = (dateStr) => dateStr ? format(new Date(dateStr), 'dd.MM.yyyy') : '-';
	const escapeHtml = (text) => {
		if (!text && text !== 0) return '-';
		return String(text)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;')
			.replace(/\n/g, '<br>');
	};

	const severityStyles = {
		'Düşük': 'background-color: #dcfce7; color: #166534;',
		'Orta': 'background-color: #fef3c7; color: #92400e;',
		'Yüksek': 'background-color: #ffedd5; color: #c2410c;',
		'Kritik': 'background-color: #fee2e2; color: #991b1b;',
	};

	const statusStyles = {
		'Açık': 'background-color: #dbeafe; color: #1d4ed8;',
		'DF Önerildi': 'background-color: #e0f2fe; color: #0369a1;',
		'8D Önerildi': 'background-color: #f3e8ff; color: #7e22ce;',
		'DF Açıldı': 'background-color: #dbeafe; color: #1d4ed8;',
		'8D Açıldı': 'background-color: #ede9fe; color: #6d28d9;',
		'Kapatıldı': 'background-color: #e5e7eb; color: #374151;',
	};

	const row = (label, value) => `
		<tr>
			<td style="width: 30%; font-weight: 600; background-color: #f8fafc;">${label}</td>
			<td style="width: 70%;">${value || '-'}</td>
		</tr>
	`;

	const localLogoUrl = getLogoUrl('logo.png');
	const mainLogoBase64 = logoCache[localLogoUrl] || localLogoUrl;

	return `
		<div class="report-header">
			<div class="report-logo">
				<img src="${mainLogoBase64}" alt="Kademe Logo">
			</div>
			<div class="company-title">
				<h1>KADEME A.Ş.</h1>
				<p>Kalite Yönetim Sistemi</p>
			</div>
			<div class="print-info">
				Rapor Tarihi: ${formatDateTime(new Date())}
			</div>
		</div>

		<div class="meta-box">
			<div class="meta-item"><strong>Belge Türü:</strong> Uygunsuzluk Yönetimi Detay Raporu</div>
			<div class="meta-item"><strong>Kayıt No:</strong> ${record.record_number || '-'}</div>
		</div>

		<div class="section">
			<h2 class="section-title blue">KAYIT ÖZETİ</h2>
			<div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px;">
				<span style="padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; ${severityStyles[record.severity] || 'background-color: #e5e7eb; color: #374151;'}">
					${record.severity || '-'}
				</span>
				<span style="padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; ${statusStyles[record.status] || 'background-color: #e5e7eb; color: #374151;'}">
					${record.status || '-'}
				</span>
			</div>
			<table class="info-table">
				<tbody>
					${row('Tespit Tarihi', formatDate(record.detection_date))}
					${row('Oluşturulma Tarihi', formatDateTime(record.created_at))}
					${row('Kategori', escapeHtml(record.category))}
					${row('Tespit Alanı', escapeHtml(record.detection_area))}
					${row('Hatalı Adet', escapeHtml(record.quantity))}
					${row('İlişkili DF/8D', record.source_nc_id || '-')}
				</tbody>
			</table>
		</div>

		<div class="section">
			<h2 class="section-title blue">PARÇA VE ÜRÜN BİLGİLERİ</h2>
			<table class="info-table">
				<tbody>
					${row('Parça Kodu', escapeHtml(record.part_code))}
					${row('Parça Adı', escapeHtml(record.part_name))}
					${row('Araç Tipi', escapeHtml(record.vehicle_type))}
					${row('Sorumlu Birim', escapeHtml(record.department))}
					${row('Sorumlu Kişi', escapeHtml(record.responsible_person))}
					${row('Tespit Eden', escapeHtml(record.detected_by))}
				</tbody>
			</table>
		</div>

		<div class="section">
			<h2 class="section-title blue">UYGUNSUZLUK DETAYI</h2>
			<div class="problem-description" style="margin-bottom: 12px;">
				<strong style="display: block; margin-bottom: 6px;">Açıklama</strong>
				${escapeHtml(record.description)}
			</div>
			${record.action_taken ? `
				<div class="problem-description" style="margin-bottom: 12px;">
					<strong style="display: block; margin-bottom: 6px;">Alınan Acil Aksiyon</strong>
					${escapeHtml(record.action_taken)}
				</div>
			` : ''}
			${record.notes ? `
				<div class="problem-description">
					<strong style="display: block; margin-bottom: 6px;">Ek Notlar</strong>
					${escapeHtml(record.notes)}
				</div>
			` : ''}
		</div>

		<div class="section signature-section">
			<h2 class="section-title dark">İMZA VE ONAY</h2>
			<div class="signature-area">
				<div class="signature-box">
					<p class="role">HAZIRLAYAN</p>
					<div class="signature-line"></div>
				</div>
				<div class="signature-box">
					<p class="role">KONTROL EDEN</p>
					<div class="signature-line"></div>
				</div>
				<div class="signature-box">
					<p class="role">ONAYLAYAN</p>
					<div class="signature-line"></div>
				</div>
			</div>
		</div>
	`;
};

const getQuarantineCertificatePrintBelgeHtml = (record, esc) => {
	const d = getQuarantineDocumentNoValue(record);
	if (!d) return '';
	return `${d.label}: ${esc(d.value)}`;
};

/** Karantina karar tutanağı: karar cümlesi + sapma formu ile aynı imza rolleri */
const buildQuarantineDecisionCertificateHtml = (record) => {
	const formatDate = (dateStr) => (dateStr ? format(new Date(dateStr), 'dd.MM.yyyy') : '-');
	const formatDateTime = (dateStr) => (dateStr ? format(new Date(dateStr), 'dd.MM.yyyy HH:mm') : '-');
	const esc = (s) =>
		String(s ?? '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	const decision = record.quarantine_certificate_decision || '';
	const statement = getQuarantineDecisionCertificateStatement(decision);
	const qty = record.quarantine_certificate_quantity;
	const notes = record.quarantine_certificate_notes;
	const unit = record.unit || '';
	const localLogoUrl = getLogoUrl('logo.png');
	const mainLogoBase64 = logoCache[localLogoUrl] || localLogoUrl;
	const belgeHtml = getQuarantineCertificatePrintBelgeHtml(record, esc);
	const docLine = belgeHtml ? `${belgeHtml}<br>` : '';
	const qtyLine =
		qty != null && String(qty).trim() !== ''
			? `<p style="margin:12px 0 0 0;"><strong>İlgili miktar:</strong> ${esc(qty)} ${esc(unit)}</p>`
			: '';
	const notesBlock = notes
		? `<div style="margin-top:14px;padding-top:12px;border-top:1px solid #e5e7eb;"><p style="font-size:12px;color:#374151;margin:0 0 6px 0;font-weight:600;">Notlar</p><pre style="white-space:pre-wrap;font-family:inherit;margin:0;font-size:13px;">${esc(notes)}</pre></div>`
		: '';

	const signatureDeviationStyle = `
					<div class="signature-box">
						<p class="role">TALEP EDEN</p>
						<div class="signature-line"></div>
						<p class="name">&nbsp;</p>
					</div>
					<div class="signature-box">
						<p class="role">ARGE</p>
						<div class="signature-line"></div>
						<p class="name">&nbsp;</p>
					</div>
					<div class="signature-box">
						<p class="role">KALİTE KONTROL<br>VE GÜVENCE</p>
						<div class="signature-line"></div>
						<p class="name">&nbsp;</p>
					</div>
					<div class="signature-box">
						<p class="role">FABRİKA MÜDÜRÜ</p>
						<div class="signature-line"></div>
						<p class="name">&nbsp;</p>
					</div>
					<div class="signature-box">
						<p class="role">GENEL MÜDÜR</p>
						<div class="signature-line"></div>
						<p class="name">Kenan Çelik</p>
					</div>
				`;

	return `
		<div class="report-header quarantine-karar-tut-header">
			<div class="report-logo">
				<img src="${mainLogoBase64}" alt="Kademe Logo">
			</div>
			<div class="company-title">
				<h1>KADEME A.Ş.</h1>
				<p>Kalite Yönetim Sistemi</p>
			</div>
			<div class="print-info">
				${docLine}
				Rapor tarihi: ${formatDateTime(new Date())}
			</div>
		</div>

		<div class="meta-box">
			<div class="meta-item"><strong>Belge Türü:</strong> Karantina Karar Tutanağı</div>
			<div class="meta-item"><strong>Karar:</strong> ${esc(decision || '-')}</div>
			<div class="meta-item"><strong>Revizyon:</strong> ${record.revision || '0'}</div>
			<div class="meta-item"><strong>Sistem:</strong> Kademe Kalite Yönetim Sistemi</div>
			<div class="meta-item"><strong>Karantina tarihi:</strong> ${formatDate(record.quarantine_date)}</div>
		</div>

		<div class="section">
			<h2 class="section-title blue">1. TEMEL BİLGİLER</h2>
			<table class="info-table">
				<tbody>
					<tr><td>Parça Adı</td><td><strong>${esc(record.part_name)}</strong></td></tr>
					<tr><td>Parça Kodu</td><td>${esc(record.part_code)}</td></tr>
					<tr><td>Lot / Seri No</td><td>${esc(record.lot_no)}</td></tr>
					<tr><td>Mevcut miktar (kayıt)</td><td><strong>${esc(record.quantity)} ${esc(unit)}</strong></td></tr>
					<tr><td>Sebep Olan Birim</td><td>${esc(record.source_department)}</td></tr>
					<tr><td>Talebi Yapan Birim</td><td>${esc(record.requesting_department)}</td></tr>
					<tr><td>Talebi Yapan Kişi</td><td>${esc(record.requesting_person_name)}</td></tr>
					<tr><td>Karantina Açıklaması</td><td><pre style="white-space:pre-wrap;font-family:inherit;">${esc(record.description)}</pre></td></tr>
				</tbody>
			</table>
		</div>

		<div class="section">
			<h2 class="section-title blue">2. KARAR</h2>
			<div style="padding: 18px; font-size: 14px; line-height: 1.65; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
				<p style="margin: 0; font-weight: 600; color: #111827;">${esc(statement)}</p>
				${qtyLine}
				${notesBlock}
			</div>
		</div>

		<div class="section signature-section">
			<h2 class="section-title dark">İMZA VE ONAY</h2>
			<div class="signature-area">
				${signatureDeviationStyle}
			</div>
		</div>
	`;
};

const generateGenericReportHtml = async (record, type) => {
	if (type === 'quarantine_decision_certificate') {
		return buildQuarantineDecisionCertificateHtml(record);
	}
	const formatDate = (dateStr) => dateStr ? format(new Date(dateStr), 'dd.MM.yyyy') : '-';
	const formatDateTime = (dateStr) => dateStr ? format(new Date(dateStr), 'dd.MM.yyyy HH:mm') : '-';
	const formatCurrency = (value) => (value || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
	const formatArray = (arr) => Array.isArray(arr) && arr.length > 0 ? arr.join(', ') : '-';

	const getAttachmentUrl = async (path, bucket) => {
		if (typeof path === 'object' && path !== null) {
			// Önce file_path'i kontrol et (deviation_attachments için)
			if (path.file_path) {
				path = path.file_path;
			} else if (path.path) {
				path = path.path;
			} else {
				return '';
			}
		}
		if (typeof path !== 'string') return '';
		// Path'teki gereksiz karakterleri temizle
		path = path.trim();
		// Eğer path 'public/' ile başlıyorsa kaldır
		if (path.startsWith('public/')) {
			path = path.substring(7);
		}
		// Eğer path '/' ile başlıyorsa kaldır
		if (path.startsWith('/')) {
			path = path.substring(1);
		}

		try {
			const { data, error } = await supabase.storage
				.from(bucket)
				.createSignedUrl(path, 60 * 60 * 24 * 30);

			if (!error && data?.signedUrl) {
				return data.signedUrl;
			}

			if (error) {
				console.warn(`Signed URL oluşturulamadı (${bucket}/${path}):`, error.message);
			}
		} catch (error) {
			console.warn(`Signed URL oluşturma hatası (${bucket}/${path}):`, error);
		}

		const { data } = supabase.storage.from(bucket).getPublicUrl(path);
		return data?.publicUrl || '';
	};

	const getDocumentNumber = () => {
		switch (type) {
			case 'nonconformity': return record.nc_number || record.mdi_no || '-';
			case 'deviation': return record.request_no || '-';
			case 'kaizen': return record.kaizen_no || '-';
			case 'quarantine':
				return getQuarantineDocumentNoValue(record)?.value || '-';
			case 'incoming_inspection': return record.record_no || '-';
			case 'process_inspection': return record.record_no || '-';
			case 'incoming_control_plans': return record.part_code || '-';
			case 'process_control_plans': return record.part_code || '-';
			case 'sheet_metal_entry': return record.delivery_note_number || '-';
			case 'supplier_audit': return `TDA-${format(new Date(record.planned_date || record.actual_date || new Date()), 'yyyy-MM')}-${record.id.substring(0, 4)}`;
			case 'internal_audit': return record.report_number || '-';
			case 'equipment': return record.serial_number || '-';
			case 'equipment_scrap_certificate':
				return record.serial_number ? `HT-${record.serial_number}` : (record.id ? `HT-${String(record.id).slice(0, 8).toUpperCase()}` : '-');
			case 'fmea':
				return record.fmea_number || '-';
			case 'fmea_project_list':
				return 'LIST';
			case 'inkr_management':
				// INKR numarası varsa onu kullan
				if (record.inkr_number && record.inkr_number.startsWith('INKR-')) {
					return record.inkr_number;
				}
				// Yoksa parça kodundan oluştur: INKR-parça_kodu
				if (record.part_code) {
					const cleanPartCode = record.part_code.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
					return `INKR-${cleanPartCode}`;
				}
				return '-';
			default: return record.id;
		}
	};

	const getDocumentType = () => {
		switch (type) {
			case 'nonconformity': return `${record.type} Raporu`;
			case 'deviation': return 'Sapma Talep Raporu';
			case 'kaizen': return 'Kaizen Raporu';
			case 'quarantine': return 'Karantina Raporu';
			case 'incoming_inspection': return 'Girdi Kontrol Raporu';
			case 'process_inspection': return 'Proses Muayene Raporu';
			case 'incoming_control_plans': return 'Kontrol Planı Raporu';
			case 'process_control_plans': return 'Proses Kontrol Planı Raporu';
			case 'sheet_metal_entry': return 'Sac Metal Giriş Raporu';
			case 'supplier_audit': return 'Tedarikçi Denetim Raporu';
			case 'internal_audit': return 'İç Tetkik Raporu';
			case 'equipment': return 'Ekipman Kalibrasyon Raporu';
			case 'equipment_scrap_certificate': return 'Ekipman Hurda Ayırma Tutanağı';
			case 'inkr_management': return 'INKR Raporu';
			case 'fmea': return 'FMEA Analiz Raporu';
			case 'fmea_project_list': return 'FMEA Proje Listesi';
			default: return 'Rapor';
		}
	};

	const getPublicationDate = () => {
		if (type === 'equipment_scrap_certificate' && record.scrap_date) {
			return formatDate(record.scrap_date);
		}
		return formatDate(record.created_at || record.opening_date || record.df_opened_at || record.quarantine_date || record.inspection_date || record.entry_date || record.audit_date || record.planned_date);
	};

	const getDeviationApprovalReference = (ref) => {
		if (!ref || typeof ref !== 'string') return '-';

		const deviationNoMatch = ref.match(/ST-\d{4}-\d+/i);
		if (deviationNoMatch) {
			return `Sapma No: ${deviationNoMatch[0]}`;
		}

		const uuidMatch = ref.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
		if (uuidMatch) {
			return `Sapma No: ${record.nc_number || uuidMatch[0]}`;
		}

		if (ref.includes('/') && ref.length > 40) {
			const parts = ref.split('/');
			const lastPart = parts[parts.length - 1];
			if (lastPart) return `Sapma No: ${lastPart}`;
		}
		return `Sapma Ref: ${ref}`;
	};


	const getGeneralInfo = () => {
		const formatDate = (dateStr) => formatDateHelper(dateStr, 'dd.MM.yyyy');
		switch (type) {
			case 'nonconformity':
				console.log('DEBUG: NC Report record:', {
					due_at: record.due_at,
					due_date: record.due_date,
					attachments: record.attachments,
					closing_attachments: record.closing_attachments,
					supplier_name: record.supplier_name,
					department: record.department
				});
				// HTML escape fonksiyonu (güvenlik için)
				const escapeHtml = (text) => {
					if (!text || typeof text !== 'string') return text || '-';
					const map = {
						'&': '&amp;',
						'<': '&lt;',
						'>': '&gt;',
						'"': '&quot;',
						"'": '&#039;'
					};
					return text.replace(/[&<>"']/g, m => map[m]);
				};

				// Türkçe karakterleri normalize et (Unicode normalization)
				const normalizeTurkishChars = (text) => {
					if (!text || typeof text !== 'string') return text;

					// Unicode normalize et (NFD -> NFC)-birleşik karakterleri düzelt
					let normalized = text.normalize('NFC');

					// Bozuk Türkçe karakterleri düzelt
					const fixes = {
						// Bozuk İ karakterleri
						'i̇': 'i',
						'İ̇': 'İ',
						'İ': 'İ',
						'ı̇': 'ı',
						// Bozuk diğer karakterler
						'ğ': 'ğ',
						'Ğ': 'Ğ',
						'ü': 'ü',
						'Ü': 'Ü',
						'ö': 'ö',
						'Ö': 'Ö',
						'ş': 'ş',
						'Ş': 'Ş',
						'ç': 'ç',
						'Ç': 'Ç'
					};

					Object.keys(fixes).forEach(broken => {
						normalized = normalized.replace(new RegExp(broken, 'g'), fixes[broken]);
					});

					return normalized;
				};

				// Problem tanımı için profesyonel formatlama
				const formatProblemDescription = (text) => {
					if (!text || typeof text !== 'string') return '-';

					// Önce Türkçe karakterleri normalize et
					text = normalizeTurkishChars(text);

					// HTML escape yap
					let escaped = escapeHtml(text);

					// Satır geçişlerini koru-boş satırları da koru
					let lines = escaped.split('\n');
					let formattedLines = [];
					let inList = false;
					let currentParagraph = [];

					for (let i = 0; i < lines.length; i++) {
						let line = lines[i];
						let trimmedLine = line.trim();

						// Boş satır-paragraf sonu veya boşluk
						if (!trimmedLine) {
							// Önceki paragrafı bitir
							if (currentParagraph.length > 0) {
								formattedLines.push(`<p style="margin: 6px 0; line-height: 1.5; color: #374151; font-size: 13px;">${currentParagraph.join(' ')}</p>`);
								currentParagraph = [];
							}
							// Liste durumunu bitir
							if (inList) {
								formattedLines.push('</ul>');
								inList = false;
							}
							// Boş satırı koru (küçük bir boşluk olarak)
							formattedLines.push('<div style="height: 4px;"></div>');
							continue;
						}

						// Başlık tespiti: "Başlık:" veya "Başlık: Değer" formatı
						const headingMatch = trimmedLine.match(/^([A-ZÇĞİÖŞÜ][^:]+):\s*(.*)$/);
						if (headingMatch) {
							const [, title, value] = headingMatch;

							// Önceki paragrafı bitir
							if (currentParagraph.length > 0) {
								formattedLines.push(`<p style="margin: 6px 0; line-height: 1.5; color: #374151; font-size: 13px;">${currentParagraph.join(' ')}</p>`);
								currentParagraph = [];
							}

							// Liste durumunu bitir
							if (inList) {
								formattedLines.push('</ul>');
								inList = false;
							}

							// Başlığı formatla-siyah bold, mavi renk yok
							if (value && value.trim()) {
								formattedLines.push(`<div style="margin-top: 10px; margin-bottom: 4px;"><strong style="color: #1f2937; font-weight: 600; font-size: 13px;">${title}:</strong> <span style="color: #374151; font-size: 13px;">${value}</span></div>`);
							} else {
								formattedLines.push(`<div style="margin-top: 10px; margin-bottom: 4px;"><strong style="color: #1f2937; font-weight: 600; font-size: 13px;">${title}:</strong></div>`);
							}
							continue;
						}

						// Liste öğesi tespiti: "* ", "- ", veya sayısal "1. ", "2. "
						const listMatch = trimmedLine.match(/^([*•-]|\d+[.,])\s+(.+)$/);
						if (listMatch) {
							// Önceki paragrafı bitir
							if (currentParagraph.length > 0) {
								formattedLines.push(`<p style="margin: 6px 0; line-height: 1.5; color: #374151; font-size: 13px;">${currentParagraph.join(' ')}</p>`);
								currentParagraph = [];
							}

							if (!inList) {
								formattedLines.push('<ul style="margin: 4px 0; padding-left: 20px; list-style-type: disc;">');
								inList = true;
							}

							const itemText = listMatch[2];
							formattedLines.push(`<li style="margin-bottom: 4px; line-height: 1.5; color: #374151; font-size: 13px;">${itemText}</li>`);
							continue;
						}

						// Liste durumunu bitir
						if (inList) {
							formattedLines.push('</ul>');
							inList = false;
						}

						// Normal metin-paragrafa ekle
						currentParagraph.push(trimmedLine);
					}

					// Son paragrafı ekle
					if (currentParagraph.length > 0) {
						formattedLines.push(`<p style="margin: 6px 0; line-height: 1.5; color: #374151; font-size: 13px;">${currentParagraph.join(' ')}</p>`);
					}

					// Son liste durumunu bitir
					if (inList) {
						formattedLines.push('</ul>');
					}

					return formattedLines.join('\n');
				};

				// Problem tanımını tablo dışında tutmak için ayrı bir değişkende sakla
				const rawProblemDesc = record.description || '';
				const descForProblem =
					hasStructuredRootCauseData(record) ?
						stripDuplicateRootCauseFromProblemDescription(rawProblemDesc)
					:	rawProblemDesc;
				const problemDescriptionHtml = descForProblem.trim() ? formatProblemDescription(descForProblem) : '-';

				return {
					tableRows: `
						<tr><td>Talep Eden Kişi</td><td>${record.requesting_person || '-'}</td></tr>
						<tr><td>Talep Eden Birim</td><td>${record.requesting_unit || '-'}</td></tr>
						<tr><td>Sorumlu Kişi</td><td>${record.responsible_person || '-'}</td></tr>
						<tr><td>Sorumlu Birim</td><td>${record.supplier_name || record.department || '-'}</td></tr>
						<tr><td>Termin Tarihi</td><td>${formatDate(record.due_at || record.due_date)}</td></tr>
					`,
					problemDescription: problemDescriptionHtml
				};
			case 'deviation':
				// HTML escape fonksiyonu (güvenlik için)
				const escapeHtmlDeviation = (text) => {
					if (!text || typeof text !== 'string') return text || '-';
					const map = {
						'&': '&amp;',
						'<': '&lt;',
						'>': '&gt;',
						'"': '&quot;',
						"'": '&#039;'
					};
					return text.replace(/[&<>"']/g, m => map[m]);
				};

				// Türkçe karakterleri normalize et (Unicode normalization)
				const normalizeTurkishCharsDeviation = (text) => {
					if (!text || typeof text !== 'string') return text;

					// Unicode normalize et (NFD -> NFC)-birleşik karakterleri düzelt
					let normalized = text.normalize('NFC');

					// Bozuk Türkçe karakterleri düzelt
					const fixes = {
						// Bozuk İ karakterleri
						'i̇': 'i',
						'İ̇': 'İ',
						'İ': 'İ',
						'ı̇': 'ı',
						// Bozuk diğer karakterler
						'ğ': 'ğ',
						'Ğ': 'Ğ',
						'ü': 'ü',
						'Ü': 'Ü',
						'ö': 'ö',
						'Ö': 'Ö',
						'ş': 'ş',
						'Ş': 'Ş',
						'ç': 'ç',
						'Ç': 'Ç'
					};

					Object.keys(fixes).forEach(broken => {
						normalized = normalized.replace(new RegExp(broken, 'g'), fixes[broken]);
					});

					return normalized;
				};

				// Sapma açıklaması için profesyonel formatlama-Detaylı ve sapmaya özel
				// DeviationDetailModal.jsx'deki formatDescription ile aynı mantık-recursive tokenization
				const formatDeviationDescription = (text) => {
					if (!text || typeof text !== 'string') return '-';

					// Önce Türkçe karakterleri normalize et
					text = normalizeTurkishCharsDeviation(text);

					// Escape edilmiş \n karakterlerini gerçek \n karakterlerine çevir
					text = text.replace(/\\n/g, '\n');

					// HTML escape yap
					let escaped = escapeHtmlDeviation(text);

					// Atlanacak başlıklar (gereksiz, zaten alt başlıklar var)
					const skipHeadings = [
						'Ölçüm Sonuçlari Ve Tespi̇tler',
						'Ölçüm Sonuçları Ve Tespitler',
						'ÖLÇÜM SONUÇLARI VE TESPİTLER',
					];

					// Bölüm başlıkları (render edilecek)
					const sectionHeadings = [
						'Uygunsuz Bulunan Ölçümler',
						'Ölçüm Özeti̇',
						'Ölçüm Özeti',
						'ÖLÇÜM ÖZETİ',
						'TESPİT EDİLEN HATALAR',
						'Tespit Edilen Hatalar',
						'Hata Detayları',
					];

					// Tüm başlıklar (ayrıştırma için)
					const allHeadings = [...skipHeadings, ...sectionHeadings];

					// Tüm key-value anahtarları (sıralı-uzundan kısaya)
					const knownKeys = [
						'Beklenen Değer \\(nominal\\)',
						'Beklenen Değer',
						'Tolerans Aralığı',
						'Gerçek Ölçülen Değer',
						'Sonuç',
						'HATALI DEĞER',
						// Turkish sensitive variations
						'Hatalı Değer',
						'Hatali Değer',
						'Sapma',
						'Toplam Ölçüm Sayısı',
						'Uygun Ölçümler',
						'Uygunsuz Ölçümler',
						'Ret Oranı',
						'Parça Kodu',
						'Parça Adı',
						'Red Edilen Miktar',
						'Şartlı Kabul Miktarı',
						'Tedarikçi',
						'Karar',
						'Teslimat No',
						'Kayıt No',
						'Muayene Tarihi',
						'Gelen Miktar',
						'Kontrol Edilen Miktar',
						'Nihai Karar',
						'Ret Nedeni̇',
						'Ret Nedeni',
						'Ret Nedenı', // Added variation
					].sort((a, b) => b.length - a.length);

					// Bir sonraki key veya heading pozisyonunu bul
					const findNextKeyOrHeadingPosition = (str, startPos) => {
						let minPos = str.length;

						// Önce tüm headings ara (skip dahil)
						for (const heading of allHeadings) {
							const regex = new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
							const match = regex.exec(str.substring(startPos));
							if (match && (startPos + match.index) < minPos) {
								minPos = startPos + match.index;
							}
						}

						// Sonra numaralı ölçüm başlıkları ara
						const numberedMeasurementRegex = /\d+\.\s+(?:Minör|Majör|Kritik)\s+Özellik\s*\([^)]+\)/gi;
						const numberedMatch = numberedMeasurementRegex.exec(str.substring(startPos));
						if (numberedMatch && (startPos + numberedMatch.index) < minPos) {
							minPos = startPos + numberedMatch.index;
						}

						// Sonra key-value pattern'leri ara
						for (const key of knownKeys) {
							const regex = new RegExp(key + ':', 'gi');
							const match = regex.exec(str.substring(startPos));
							if (match && (startPos + match.index) < minPos) {
								minPos = startPos + match.index;
							}
						}

						return minPos;
					};

					// Metni token'lara ayır-recursive tokenization
					const tokenize = (str) => {
						const tokens = [];
						let remaining = str;

						// Önce ana başlığı kontrol et
						const mainTitleMatch = remaining.match(/^(Girdi Kalite Kontrol Kaydı|Karantina Kaydı|(Kalite|Kalitesizlik) Maliyeti Kaydı)\s*\([^)]+\)/i);
						if (mainTitleMatch) {
							tokens.push({ type: 'mainHeading', value: mainTitleMatch[0].trim() });
							remaining = remaining.substring(mainTitleMatch[0].length).trim();
						}

						// Geri kalan metni işle
						while (remaining.length > 0) {
							remaining = remaining.trim();
							if (!remaining) break;

							let matched = false;

							// Skip heading kontrol et (atla, render etme)
							for (const heading of skipHeadings) {
								const regex = new RegExp('^(' + heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')[:\\s]*', 'i');
								const match = remaining.match(regex);
								if (match) {
									// Bu başlığı atla, token ekleme
									remaining = remaining.substring(match[0].length).trim();
									matched = true;
									break;
								}
							}
							if (matched) continue;

							// Section heading kontrol et (render et)
							for (const heading of sectionHeadings) {
								const regex = new RegExp('^(' + heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')[:\\s]*', 'i');
								const match = remaining.match(regex);
								if (match) {
									tokens.push({ type: 'sectionHeading', value: match[1].trim() });
									remaining = remaining.substring(match[0].length).trim();
									matched = true;
									break;
								}
							}
							if (matched) continue;

							// Numaralı ölçüm başlığı kontrol et
							const numberedMeasurementMatch = remaining.match(/^(\d+\.\s+(?:Minör|Majör|Kritik)\s+Özellik\s*\([^)]+\))[:\s]*/i);
							if (numberedMeasurementMatch) {
								tokens.push({ type: 'numberedMeasurement', value: numberedMeasurementMatch[1].trim() });
								remaining = remaining.substring(numberedMeasurementMatch[0].length).trim();
								continue;
							}

							// Key-value kontrol et
							for (const key of knownKeys) {
								const regex = new RegExp('^(' + key + '):\\s*', 'i');
								const match = remaining.match(regex);
								if (match) {
									const keyName = match[1];
									remaining = remaining.substring(match[0].length).trim();

									// Bir sonraki key veya heading pozisyonunu bul
									const nextPos = findNextKeyOrHeadingPosition(remaining, 0);
									let valueStr = remaining.substring(0, nextPos).trim();
									remaining = remaining.substring(nextPos).trim();

									// Value içinde herhangi bir heading varsa (skip dahil), onu ayır
									let foundSectionInValue = false;
									for (const heading of allHeadings) {
										const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
										// Heading value içinde herhangi bir yerde olabilir (başta dahil)
										const headingRegex = new RegExp('^(.*?)\\s*(' + escapedHeading + ')[:\\s]*(.*)$', 'i');
										const headingMatch = valueStr.match(headingRegex);
										if (headingMatch) {
											valueStr = headingMatch[1].trim();
											// Heading ve sonrasını remaining'e geri ekle
											const headingPart = headingMatch[2] + (headingMatch[3] ? ': ' + headingMatch[3] : '');
											remaining = headingPart.trim() + ' ' + remaining;
											foundSectionInValue = true;
											break;
										}
									}

									// Value içinde "Bu Parça Için Sapma Onayı Talep Edilmektedir." varsa, ayır
									const conclusionInValueMatch = valueStr.match(/([\s\S]*?)(Bu Parça [İI]çin Sapma Onayı Talep Edilmektedir\.?)/i);
									if (conclusionInValueMatch) {
										valueStr = conclusionInValueMatch[1].trim();
										tokens.push({ type: 'keyValue', key: keyName, value: valueStr });
										tokens.push({ type: 'conclusion', value: conclusionInValueMatch[2] });
									} else {
										tokens.push({ type: 'keyValue', key: keyName, value: valueStr });
									}
									matched = true;
									break;
								}
							}
							if (matched) continue;

							// "Bu Parça Için Sapma Onayı Talep Edilmektedir." kontrol et
							const conclusionMatch = remaining.match(/^(Bu Parça [İI]çin Sapma Onayı Talep Edilmektedir\.?)/i);
							if (conclusionMatch) {
								tokens.push({ type: 'conclusion', value: conclusionMatch[1] });
								remaining = remaining.substring(conclusionMatch[0].length).trim();
								continue;
							}

							// Eğer hiçbir pattern eşleşmediyse, bir sonraki key/heading'e kadar olan kısmı al
							const nextPos = findNextKeyOrHeadingPosition(remaining, 1);
							if (nextPos > 0 && nextPos < remaining.length) {
								const text = remaining.substring(0, nextPos).trim();
								if (text) {
									tokens.push({ type: 'text', value: text });
								}
								remaining = remaining.substring(nextPos).trim();
							} else {
								// Geri kalan herşeyi text olarak ekle
								if (remaining.trim()) {
									tokens.push({ type: 'text', value: remaining.trim() });
								}
								break;
							}
						}

						return tokens;
					};

					const tokens = tokenize(escaped);
					let formattedLines = [];

					for (const token of tokens) {
						switch (token.type) {
							case 'mainHeading':
								formattedLines.push(`<div style="margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #e5e7eb;"><strong style="font-weight: 700; font-size: 14px; color: #111827;">${token.value}</strong></div>`);
								break;
							case 'sectionHeading':
								formattedLines.push(`<div style="margin-top: 12px; margin-bottom: 6px; background-color: #f3f4f6; padding: 6px 10px; border-radius: 4px;"><strong style="font-weight: 600; font-size: 13px; color: #1f2937; text-transform: uppercase;">${token.value}</strong></div>`);
								break;
							case 'numberedMeasurement':
								formattedLines.push(`<div style="margin-top: 10px; margin-bottom: 4px; padding-left: 8px; border-left: 3px solid #3b82f6;"><strong style="font-weight: 600; font-size: 13px; color: #1f2937;">${token.value}</strong></div>`);
								break;
							case 'keyValue':
								let displayValue = (token.value === 'N/A' || token.value === 'N/A adet' || !token.value) ? 'Belirtilmemiş' : token.value;

								// skipHeadings'i value'dan temizle (veritabanından gelen eski veriler için)
								// Önce spesifik başlıkları temizle
								for (const skipHeading of skipHeadings) {
									// Escape special regex chars
									const escapedHeading = skipHeading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
									// Case-insensitive, boşluk toleranslı regex (başta, sonda veya ortada)
									const skipRegex = new RegExp('\\s*' + escapedHeading.replace(/\\s+/g, '\\s+') + '[:\\s]*', 'gi');
									displayValue = displayValue.replace(skipRegex, ' ').trim();
								}

								// Genel pattern: "Ölçüm Sonuç" ile başlayan ve "Tespit" içeren her şeyi temizle
								// Bu, tüm varyasyonları (noktalı i, büyük/küçük harf, vb.) yakalar
								const generalSkipRegex = /\s*Ölçüm\s+Sonuç[^\s]*\s+Ve\s+Tespit[^\s]*[:]?\s*/gi;
								displayValue = displayValue.replace(generalSkipRegex, ' ').trim();

								// Tekrar tekrar boşlukları temizle
								displayValue = displayValue.replace(/\s+/g, ' ').trim();

								// Sonuç için Türkçe isimler ve renk
								const isSonucKey = token.key.toLowerCase() === 'sonuç';
								const isFailResult = isSonucKey && token.value.toLowerCase() === 'false';
								const isPassResult = isSonucKey && token.value.toLowerCase() === 'true';

								// False/True değerlerini Türkçe'ye çevir
								if (isFailResult) {
									displayValue = 'Uygunsuz';
								} else if (isPassResult) {
									displayValue = 'Uygun';
								}

								const valueStyle = isFailResult
									? 'color: #dc2626; font-weight: 500;'
									: 'color: #374151;';
								formattedLines.push(`<div style="margin-bottom: 4px; margin-left: 12px; line-height: 1.6;"><strong style="font-weight: 500; font-size: 12px; color: #6b7280;">${token.key}:</strong> <span style="font-size: 12px; ${valueStyle}">${displayValue}</span></div>`);
								break;
							case 'conclusion':
								formattedLines.push(`<div style="margin-top: 12px; padding: 8px 12px; background-color: #fef3c7; border-radius: 4px; font-weight: 500; font-size: 13px; color: #92400e;">${token.value}</div>`);
								break;
							case 'text':
							default:
								formattedLines.push(`<div style="margin-bottom: 4px; line-height: 1.6; color: #374151; font-size: 13px;">${token.value}</div>`);
								break;
						}
					}

					return formattedLines.join('\n');
				};

				// Sapma açıklamasını tablo dışında tutmak için ayrı bir değişkende sakla
				const deviationDescriptionHtml = record.description ? formatDeviationDescription(record.description) : '-';

				// Etkilenen Araçlar tablosu
				let vehiclesHtml = '';
				if (record.deviation_vehicles && Array.isArray(record.deviation_vehicles) && record.deviation_vehicles.length > 0) {
					vehiclesHtml = `
						<tr><td colspan="2">
							<h3 style="margin-top: 15px; margin-bottom: 10px;">Etkilenen Araçlar</h3>
							<table class="details-table" style="width: 100%; margin-top: 10px; border-collapse: collapse;">
								<thead>
									<tr style="background-color: #f3f4f6; border: 1px solid #d1d5db;">
										<th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Müşteri Adı</th>
										<th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Şasi No</th>
										<th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Araç Seri No</th>
										<th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Parça adedi (araç)</th>
									</tr>
								</thead>
								<tbody>
									${record.deviation_vehicles.map(v => `
										<tr style="border-bottom: 1px solid #d1d5db;">
											<td style="border: 1px solid #d1d5db; padding: 8px;">${v.customer_name || '-'}</td>
											<td style="border: 1px solid #d1d5db; padding: 8px;">${v.chassis_no || '-'}</td>
											<td style="border: 1px solid #d1d5db; padding: 8px;">${v.vehicle_serial_no || '-'}</td>
											<td style="border: 1px solid #d1d5db; padding: 8px;">${v.part_quantity_per_vehicle != null ? v.part_quantity_per_vehicle : '-'}</td>
										</tr>
									`).join('')}
								</tbody>
							</table>
						</td></tr>
					`;
				}

				return {
					tableRows: `
						<tr><td>Talep Eden Kişi</td><td>${record.requesting_person || '-'}</td></tr>
						<tr><td>Talep Eden Birim</td><td>${record.requesting_unit || '-'}</td></tr>
						<tr><td>Sapma İstenilen Parça Kodu</td><td><strong>${record.part_code || '-'}</strong></td></tr>
						${record.part_name ? `<tr><td>Parça Adı</td><td>${record.part_name}</td></tr>` : ''}
						<tr><td>Sapma Kaynağı</td><td>${record.source || '-'}</td></tr>
						<tr><td>Araç Tipi</td><td>${record.vehicle_type || '-'}</td></tr>
						${vehiclesHtml}
					`,
					problemDescription: deviationDescriptionHtml
				};
			case 'kaizen':
				// HTML escape fonksiyonu (güvenlik için)
				const escapeHtmlKaizen = (text) => {
					if (!text || typeof text !== 'string') return text || '-';
					const map = {
						'&': '&amp;',
						'<': '&lt;',
						'>': '&gt;',
						'"': '&quot;',
						"'": '&#039;'
					};
					return text.replace(/[&<>"']/g, m => map[m]);
				};

				// Türkçe karakterleri normalize et (Unicode normalization)
				const normalizeTurkishCharsKaizen = (text) => {
					if (!text || typeof text !== 'string') return text;

					let normalized = text.normalize('NFC');

					const fixes = {
						'i̇': 'i',
						'İ̇': 'İ',
						'İ': 'İ',
						'ı̇': 'ı',
						'ğ': 'ğ',
						'Ğ': 'Ğ',
						'ü': 'ü',
						'Ü': 'Ü',
						'ö': 'ö',
						'Ö': 'Ö',
						'ş': 'ş',
						'Ş': 'Ş',
						'ç': 'ç',
						'Ç': 'Ç'
					};

					Object.keys(fixes).forEach(broken => {
						normalized = normalized.replace(new RegExp(broken, 'g'), fixes[broken]);
					});

					return normalized;
				};

				// Problem tanımı için profesyonel formatlama
				const formatProblemDescriptionKaizen = (text) => {
					if (!text || typeof text !== 'string') return '-';

					// Önce Türkçe karakterleri normalize et
					text = normalizeTurkishCharsKaizen(text);

					let escaped = escapeHtmlKaizen(text);

					// Satır geçişlerini koru-boş satırları da koru
					let lines = escaped.split('\n');
					let formattedLines = [];
					let inList = false;
					let currentParagraph = [];

					for (let i = 0; i < lines.length; i++) {
						let line = lines[i];
						let trimmedLine = line.trim();

						// Boş satır-paragraf sonu veya boşluk
						if (!trimmedLine) {
							// Önceki paragrafı bitir
							if (currentParagraph.length > 0) {
								formattedLines.push(`<p style="margin: 6px 0; line-height: 1.5; color: #374151; font-size: 13px;">${currentParagraph.join(' ')}</p>`);
								currentParagraph = [];
							}
							// Liste durumunu bitir
							if (inList) {
								formattedLines.push('</ul>');
								inList = false;
							}
							// Boş satırı koru (küçük bir boşluk olarak)
							formattedLines.push('<div style="height: 4px;"></div>');
							continue;
						}

						// Başlık tespiti: "Başlık:" veya "Başlık: Değer" formatı
						const headingMatch = trimmedLine.match(/^([A-ZÇĞİÖŞÜ][^:]+):\s*(.*)$/);
						if (headingMatch) {
							const [, title, value] = headingMatch;

							// Önceki paragrafı bitir
							if (currentParagraph.length > 0) {
								formattedLines.push(`<p style="margin: 6px 0; line-height: 1.5; color: #374151; font-size: 13px;">${currentParagraph.join(' ')}</p>`);
								currentParagraph = [];
							}

							// Liste durumunu bitir
							if (inList) {
								formattedLines.push('</ul>');
								inList = false;
							}

							// Başlığı formatla-daha küçük ve profesyonel
							if (value && value.trim()) {
								formattedLines.push(`<div style="margin-top: 10px; margin-bottom: 4px;"><strong style="color: #2563eb; font-weight: 600; font-size: 13px;">${title}:</strong> <span style="color: #374151; font-size: 13px;">${value}</span></div>`);
							} else {
								formattedLines.push(`<div style="margin-top: 10px; margin-bottom: 4px;"><strong style="color: #2563eb; font-weight: 600; font-size: 13px;">${title}:</strong></div>`);
							}
							continue;
						}

						// Liste öğesi tespiti: "* ", "- ", veya sayısal "1. ", "2. "
						const listMatch = trimmedLine.match(/^([*•-]|\d+[.,])\s+(.+)$/);
						if (listMatch) {
							// Önceki paragrafı bitir
							if (currentParagraph.length > 0) {
								formattedLines.push(`<p style="margin: 6px 0; line-height: 1.5; color: #374151; font-size: 13px;">${currentParagraph.join(' ')}</p>`);
								currentParagraph = [];
							}

							if (!inList) {
								formattedLines.push('<ul style="margin: 4px 0; padding-left: 20px; list-style-type: disc;">');
								inList = true;
							}

							const itemText = listMatch[2];
							formattedLines.push(`<li style="margin-bottom: 4px; line-height: 1.5; color: #374151; font-size: 13px;">${itemText}</li>`);
							continue;
						}

						// Liste durumunu bitir
						if (inList) {
							formattedLines.push('</ul>');
							inList = false;
						}

						// Normal metin-paragrafa ekle
						currentParagraph.push(trimmedLine);
					}

					// Son paragrafı ekle
					if (currentParagraph.length > 0) {
						formattedLines.push(`<p style="margin: 6px 0; line-height: 1.5; color: #374151; font-size: 13px;">${currentParagraph.join(' ')}</p>`);
					}

					// Son liste durumunu bitir
					if (inList) {
						formattedLines.push('</ul>');
					}

					return formattedLines.join('\n');
				};

				const teamMembers = record.team_members_profiles?.map(p => p.full_name).join(', ') || '-';
				const duration = record.start_date && record.end_date ? `${differenceInDays(new Date(record.end_date), new Date(record.start_date))} gün` : '-';
				return `
					<tr><td>Kaizen Konusu</td><td>${record.title || '-'}</td></tr>
					<tr><td>Problem Tanımı</td><td><div style="white-space: normal; word-wrap: break-word; padding: 8px; background-color: #ffffff; border-radius: 4px; border: 1px solid #e5e7eb; font-size: 13px; line-height: 1.5;">${formatProblemDescriptionKaizen(record.description || '-')}</div></td></tr>
					<tr><td>Öneri Sahibi</td><td>${record.proposer?.full_name || '-'}</td></tr>
					<tr><td>Sorumlu Kişi</td><td>${record.responsible_person?.full_name || '-'}</td></tr>
					<tr><td>Departman</td><td>${record.department?.unit_name || '-'}</td></tr>
					<tr><td>Kaizen Ekibi</td><td>${teamMembers}</td></tr>
					<tr><td>Süre</td><td>${duration}</td></tr>
				`;
			case 'quarantine': {
				const deviationRef = record.deviation_approval_url ? `<tr><td>İlişkili Sapma</td><td>${getDeviationApprovalReference(record.deviation_approval_url)}</td></tr>` : '';
				const nonConformityRef = record.non_conformity_id ? `<tr><td>İlişkili Uygunsuzluk</td><td>${record.nc_number || 'Uygunsuzluk ID: ' + record.non_conformity_id}</td></tr>` : '';
				const hurdaKararRows =
					record.hurda_processed_quantity != null && record.hurda_processed_quantity !== ''
						? `
				<tr><td>Hurda işlem miktarı</td><td><strong>${record.hurda_processed_quantity} ${record.unit || ''}</strong></td></tr>
				${record.hurda_notes ? `<tr><td>Karar notları</td><td><pre style="white-space: pre-wrap; font-family: inherit;">${record.hurda_notes}</pre></td></tr>` : ''}`
						: '';
				return `
				<tr><td>Parça Adı</td><td><strong>${record.part_name}</strong></td></tr>
				<tr><td>Parça Kodu</td><td>${record.part_code || '-'}</td></tr>
				<tr><td>Lot / Seri No</td><td>${record.lot_no || '-'}</td></tr>
				<tr><td>Mevcut Miktar</td><td><strong>${record.quantity} ${record.unit}</strong></td></tr>
				<tr><td>Karantina Tarihi</td><td>${formatDate(record.quarantine_date)}</td></tr>
				<tr><td>Durum</td><td><span style="padding: 4px 12px; border-radius: 4px; font-weight: 600; ${record.status === 'Karantinada' ? 'background-color: #fee2e2; color: #991b1b;' :
						record.status === 'Tamamlandı' ? 'background-color: #d1fae5; color: #065f46;' :
							record.status === 'Serbest Bırakıldı' ? 'background-color: #dbeafe; color: #1e40af;' :
								'background-color: #e5e7eb; color: #374151;'
					}">${record.status || 'Bilinmiyor'}</span></td></tr>
				<tr><td>Sebep Olan Birim</td><td>${record.source_department || '-'}</td></tr>
				<tr><td>Sebep Olan Tedarikçi</td><td>${record.supplier_name || '-'}</td></tr>
				<tr><td>Talebi Yapan Birim</td><td>${record.requesting_department || '-'}</td></tr>
				<tr><td>Talebi Yapan Kişi</td><td>${record.requesting_person_name || '-'}</td></tr>
				<tr><td>Karantina Sebebi / Açıklama</td><td><pre style="white-space: pre-wrap; font-family: inherit;">${record.description || '-'}</pre></td></tr>
				${hurdaKararRows}
				${deviationRef}
				${nonConformityRef}
			`;
			}
			case 'incoming_inspection':
				const defectsHtml = record.defects && record.defects.length > 0
					? record.defects.map(d => `<li><strong>${d.defect_type || '-'}</strong>: ${d.description || '-'}</li>`).join('')
					: '<li>Kusur tespit edilmemiştir.</li>';

				const resultsTableHtml = record.results && record.results.length > 0
					? `<table class="details-table" style="width: 100%; margin-top: 10px; border-collapse: collapse;">
					<thead>
						<tr style="background-color: #f3f4f6; border: 1px solid #d1d5db;">
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Özellik</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Yöntem</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Ölçüm No</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Nominal</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Min</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Mak</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Ölçülen</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Sonuç</th>
						</tr>
					</thead>
					<tbody>
						${record.results.map(r => `
							<tr style="border-bottom: 1px solid #d1d5db;">
								<td style="border: 1px solid #d1d5db; padding: 8px;">${r.feature || '-'}</td>
								<td style="border: 1px solid #d1d5db; padding: 8px; font-size: 0.9em;">${r.measurement_method || '-'}</td>
								<td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-weight: bold;">${r.measurement_number || '-'} / ${r.total_measurements || '-'}</td>
								<td style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">${r.nominal_value || '-'}</td>
								<td style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">${r.min_value || '-'}</td>
								<td style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">${r.max_value || '-'}</td>
								<td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-weight: bold;">${r.actual_value || '-'}</td>
								<td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-weight: bold; color: ${r.result ? '#16a34a' : '#dc2626'};">${r.result ? '✓ OK' : '✗ NOK'}</td>
							</tr>
						`).join('')}
					</tbody>
				</table>`
					: '<p>Muayene sonuçları bulunamadı.</p>';

				// Stok risk kontrolü bilgisi
				let stockRiskControlHtml = '';
				if (record.stock_risk_controls && Array.isArray(record.stock_risk_controls) && record.stock_risk_controls.length > 0) {
					const controls = record.stock_risk_controls;
					stockRiskControlHtml = `
					<tr><td colspan="2">
						<h3 style="margin-top: 15px; margin-bottom: 10px; color: #dc2626;">Stok Risk Kontrolü</h3>
						<div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 10px; margin: 10px 0;">
							<p style="margin: 5px 0;"><strong>Durum:</strong> ${controls[0].status || 'Beklemede'}</p>
							${controls[0].decision ? `<p style="margin: 5px 0;"><strong>Karar:</strong> ${controls[0].decision}</p>` : ''}
							${controls[0].created_at ? `<p style="margin: 5px 0;"><strong>Başlatma Tarihi:</strong> ${formatDate(controls[0].created_at)}</p>` : ''}
							<p style="margin: 5px 0;"><strong>Kontrol Sayısı:</strong> ${controls.length} adet</p>
						</div>
					</td></tr>
				`;
				}

				return `
			<tr><td>Tedarikçi</td><td>${record.supplier?.name || record.supplier_name || '-'}</td></tr>
			<tr><td>İrsaliye Numarası</td><td>${record.delivery_note_number || '-'}</td></tr>
			<tr><td>Parça Adı / Kodu</td><td>${record.part_name || '-'} / ${record.part_code || '-'}</td></tr>
			<tr><td>Gelen Miktar</td><td>${record.quantity_received || 0} ${record.unit || 'Adet'}</td></tr>
			<tr><td>Muayene Tarihi</td><td>${formatDate(record.inspection_date)}</td></tr>
			<tr><td>Karar</td><td><strong style="font-weight: bold; ${record.decision === 'Kabul' ? 'color: #16a34a' : record.decision === 'Ret' ? 'color: #dc2626' : 'color: #f59e0b'}">${record.decision || 'Beklemede'}</strong></td></tr>
			<tr><td>Kabul Edilen</td><td>${record.quantity_accepted || 0} ${record.unit || 'Adet'}</td></tr>
			<tr><td>Şartlı Kabul</td><td>${record.quantity_conditional || 0} ${record.unit || 'Adet'}</td></tr>
			<tr><td>Reddedilen</td><td>${record.quantity_rejected || 0} ${record.unit || 'Adet'}</td></tr>
			${stockRiskControlHtml}
			<tr><td colspan="2"><h3 style="margin-top: 15px; margin-bottom: 10px;">Tespit Edilen Kusurlar</h3><ul>${defectsHtml}</ul></td></tr>
			<tr><td colspan="2"><h3 style="margin-top: 15px; margin-bottom: 10px;">Muayene Sonuçları (Ölçüm Detayları)</h3>${resultsTableHtml}</td></tr>
		`;
			case 'process_inspection': {
				const defectsHtml = record.defects && record.defects.length > 0
					? record.defects.map(d => `<li><strong>${d.defect_type || '-'}</strong>: ${d.description || '-'}</li>`).join('')
					: '<li>Hata kaydı bulunmamaktadır.</li>';

				const resultsTableHtml = record.results && record.results.length > 0
					? `<table class="details-table" style="width: 100%; margin-top: 10px; border-collapse: collapse;">
					<thead>
						<tr style="background-color: #f3f4f6; border: 1px solid #d1d5db;">
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Karakteristik</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Yöntem</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Ölçüm No</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Nominal</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Min</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Max</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Ölçülen</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Sonuç</th>
						</tr>
					</thead>
					<tbody>
						${record.results.map(r => {
							const normalizedResult =
								typeof r.result === 'boolean'
									? r.result
									: ['ok', 'uygun', 'kabul', 'pass', 'geçer', 'gecer'].includes(
										String(r.measured_value || r.actual_value || r.measurement_value || '').trim().toLowerCase()
									);

							return `
								<tr style="border-bottom: 1px solid #d1d5db;">
									<td style="border: 1px solid #d1d5db; padding: 8px;">${r.characteristic_name || r.feature || '-'}</td>
									<td style="border: 1px solid #d1d5db; padding: 8px; font-size: 0.9em;">${r.measurement_method || '-'}</td>
									<td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-weight: bold;">${r.measurement_number || '-'} / ${r.total_measurements || '-'}</td>
									<td style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">${r.nominal_value || '-'}</td>
									<td style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">${r.min_value ?? '-'}</td>
									<td style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">${r.max_value ?? '-'}</td>
									<td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-weight: bold;">${r.measured_value || r.actual_value || r.measurement_value || '-'}</td>
									<td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-weight: bold; color: ${normalizedResult ? '#16a34a' : '#dc2626'};">${normalizedResult ? '✓ UYGUN' : '✗ RET'}</td>
								</tr>
							`;
						}).join('')}
					</tbody>
				</table>`
					: '<p>Muayene sonuçları bulunamadı.</p>';

				const acceptedQuantity =
					record.quantity_accepted ??
					Math.max(
						(Number(record.quantity_produced) || 0) -
						(Number(record.quantity_rejected) || 0) -
						(Number(record.quantity_conditional) || 0),
						0
					);

				return `
			<tr><td>Kayıt No</td><td>${record.record_no || '-'}</td></tr>
			<tr><td>Parça Kodu</td><td>${record.part_code || '-'}</td></tr>
			<tr><td>Parça Adı</td><td>${record.part_name || '-'}</td></tr>
			<tr><td>Operatör</td><td>${record.operator_name || '-'}</td></tr>
			<tr><td>Muayene Tarihi</td><td>${formatDate(record.inspection_date)}</td></tr>
			<tr><td>Karar</td><td><strong style="font-weight: bold; ${record.decision === 'Kabul' ? 'color: #16a34a' : record.decision === 'Ret' ? 'color: #dc2626' : 'color: #f59e0b'}">${record.decision || 'Beklemede'}</strong></td></tr>
			<tr><td>Üretilen Miktar</td><td>${record.quantity_produced || 0} Adet</td></tr>
			<tr><td>Kabul Edilen</td><td>${acceptedQuantity} Adet</td></tr>
			<tr><td>Şartlı Kabul</td><td>${record.quantity_conditional || 0} Adet</td></tr>
			<tr><td>Reddedilen</td><td>${record.quantity_rejected || 0} Adet</td></tr>
			<tr><td>Açıklama / Notlar</td><td><pre style="white-space: pre-wrap; font-family: inherit;">${record.notes || '-'}</pre></td></tr>
			<tr><td colspan="2"><h3 style="margin-top: 15px; margin-bottom: 10px;">Tespit Edilen Hatalar</h3><ul>${defectsHtml}</ul></td></tr>
			<tr><td colspan="2"><h3 style="margin-top: 15px; margin-bottom: 10px;">Ölçüm Sonuçları</h3>${resultsTableHtml}</td></tr>
		`;
			}
			case 'sheet_metal_entry': {
				const itemsTableHtml = record.sheet_metal_items && record.sheet_metal_items.length > 0
					? `<table class="details-table" style="width: 100%; margin-top: 10px; border-collapse: collapse;">
					<thead>
						<tr style="background-color: #f3f4f6; border: 1px solid #d1d5db;">
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Kalem No</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Boyutlar (L×G×K)</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Ağırlık (kg)</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Miktar</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Kalite</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Standart</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Heat No</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Coil No</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Sertlik</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Karar</th>
						</tr>
					</thead>
					<tbody>
						${record.sheet_metal_items.map((item, idx) => `
							<tr style="border-bottom: 1px solid #d1d5db;">
								<td style="border: 1px solid #d1d5db; padding: 8px; font-weight: bold;">${idx + 1}</td>
								<td style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">${item.uzunluk || '-'} × ${item.genislik || '-'} × ${item.kalinlik || '-'}</td>
								<td style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">${item.weight || '-'}</td>
								<td style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">${item.quantity || '-'}</td>
								<td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-size: 0.9em;">${item.material_quality || '-'}</td>
								<td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-size: 0.9em;">${item.malzeme_standarti || '-'}</td>
								<td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-size: 0.9em;">${item.heat_number || '-'}</td>
								<td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-size: 0.9em;">${item.coil_no || '-'}</td>
								<td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-size: 0.9em;">${item.hardness || '-'}</td>
								<td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-weight: bold; color: ${item.decision === 'Kabul' || item.decision === 'Kabul Edildi' ? '#16a34a' : item.decision === 'Ret' ? '#dc2626' : '#f59e0b'};">${item.decision || 'Beklemede'}</td>
							</tr>
						`).join('')}
					</tbody>
				</table>`
					: '<p>Kalem bilgisi bulunamadı.</p>';

				// Detaylı bilgiler her kalem için
				const detailedItemsHtml = record.sheet_metal_items && record.sheet_metal_items.length > 0
					? record.sheet_metal_items.map((item, idx) => `
				<div style="margin-bottom: 20px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; background-color: #fafafa;">
					<h4 style="margin-top: 0; margin-bottom: 10px; border-bottom: 2px solid #2563eb; padding-bottom: 8px; color: #1f2937;">Kalem ${idx + 1}-Detaylı Bilgiler</h4>
					
					<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
						<div>
							<h5 style="margin: 0 0 10px 0; color: #374151; font-size: 0.95em;">Malzeme Özellikleri</h5>
							<table style="width: 100%; border-collapse: collapse; font-size: 0.9em;">
								<tr><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;"><strong>Uzunluk (mm):</strong></td><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;">${item.uzunluk || '-'}</td></tr>
								<tr><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;"><strong>Genişlik (mm):</strong></td><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;">${item.genislik || '-'}</td></tr>
								<tr><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;"><strong>Kalınlık (mm):</strong></td><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;">${item.kalinlik || '-'}</td></tr>
								<tr><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;"><strong>Kalite:</strong></td><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;">${item.material_quality || '-'}</td></tr>
								<tr><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;"><strong>Standart:</strong></td><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;">${item.malzeme_standarti || '-'}</td></tr>
							</table>
						</div>
						
						<div>
							<h5 style="margin: 0 0 10px 0; color: #374151; font-size: 0.95em;">Lot & Referans Bilgileri</h5>
							<table style="width: 100%; border-collapse: collapse; font-size: 0.9em;">
								<tr><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;"><strong>Lot No:</strong></td><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;">${item.lot_number || '-'}</td></tr>
								<tr><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;"><strong>Heat No (Şarj):</strong></td><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;">${item.heat_number || '-'}</td></tr>
								<tr><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;"><strong>Coil No (Bobin):</strong></td><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;">${item.coil_no || '-'}</td></tr>
								<tr><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;"><strong>Sertifika Türü:</strong></td><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;">${item.sertifika_turu || '-'}</td></tr>
							</table>
						</div>
					</div>
					
					<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
						<div>
							<h5 style="margin: 0 0 10px 0; color: #374151; font-size: 0.95em;">Test Sonuçları</h5>
							<table style="width: 100%; border-collapse: collapse; font-size: 0.9em;">
								<tr><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;"><strong>Sertlik (HRB/HRC):</strong></td><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;">${item.hardness || '-'}</td></tr>
								<tr><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;"><strong>Ağırlık (kg):</strong></td><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;">${item.weight || '-'}</td></tr>
								<tr><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;"><strong>Adet:</strong></td><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;">${item.quantity || '-'}</td></tr>
								<tr><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;"><strong>Karar:</strong></td><td style="padding: 4px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: ${item.decision === 'Kabul' || item.decision === 'Kabul Edildi' ? '#16a34a' : item.decision === 'Ret' ? '#dc2626' : '#f59e0b'};">${item.decision || 'Beklemede'}</td></tr>
							</table>
						</div>
						
						<div>
							<h5 style="margin: 0 0 10px 0; color: #374151; font-size: 0.95em;">Sertifika Bilgileri</h5>
							${item.certificates && item.certificates.length > 0
							? `<ul style="margin: 0; padding-left: 20px; font-size: 0.9em;">
									${item.certificates.map((cert, cidx) => {
								const certName = typeof cert === 'string' ? cert.split('/').pop() : cert.name || cert.path?.split('/').pop() || `Sertifika ${cidx + 1}`;
								return `<li>${certName}</li>`;
							}).join('')}
								  </ul>`
							: '<p style="margin: 0; font-size: 0.9em; color: #6b7280;">Sertifika belirtilmemiş</p>'
						}
						</div>
					</div>
				</div>
			`).join('')
					: '<p>Kalem bilgisi bulunamadı.</p>';

				return `
			<tr><td>Tedarikçi</td><td>${record.supplier?.name || record.supplier_name || '-'}</td></tr>
						<tr><td>İrsaliye No</td><td>${record.delivery_note_number || '-'}</td></tr>
						<tr><td>Giriş Tarihi</td><td>${formatDate(record.entry_date)}</td></tr>
			<tr><td colspan="2"><h3 style="margin-top: 15px; margin-bottom: 10px;">Giriş Yapılan Kalemler (Özet Tablo)</h3>${itemsTableHtml}</td></tr>
			<tr><td colspan="2"><h3 style="margin-top: 20px; margin-bottom: 15px;">Giriş Yapılan Kalemler (Detaylı Bilgiler)</h3>${detailedItemsHtml}</td></tr>
					`;
				break;
			}
			case 'supplier_audit': {
				const getGradeInfo = (score) => {
					if (score === null || score === undefined) return { grade: 'N/A', description: 'Puanlanmamış', color: '#6b7280' };
					if (score >= 90) return { grade: 'A', description: 'Stratejik İş Ortağı', color: '#16a34a' };
					if (score >= 75) return { grade: 'B', description: 'Güvenilir Tedarikçi', color: '#2563eb' };
					if (score >= 60) return { grade: 'C', description: 'İzlemeye Alınacak', color: '#f59e0b' };
					return { grade: 'D', description: 'İş Birliği Sonlandırılacak', color: '#dc2626' };
				};
				const gradeInfo = getGradeInfo(record.score);

				// Denetçiler ve tedarikçi temsilcileri formatla
				const auditorsText = formatArray(record.participants);
				const supplierAttendeesText = formatArray(record.supplier_attendees);

				return `
					<tr>
						<td style="width: 25%; vertical-align: top; font-weight: 600; padding: 10px 8px; background-color: #f9fafb;">Tedarikçi</td>
						<td style="padding: 10px 8px;"><strong style="font-size: 1.05em; color: #111827;">${record.supplier?.name || '-'}</strong></td>
					</tr>
					<tr>
						<td style="vertical-align: top; font-weight: 600; padding: 10px 8px; background-color: #f9fafb;">Denetim Tarihi</td>
						<td style="padding: 10px 8px;">${formatDate(record.actual_date || record.planned_date)}</td>
					</tr>
					<tr>
						<td style="vertical-align: top; font-weight: 600; padding: 10px 8px; background-color: #f9fafb;">Denetçiler</td>
						<td style="padding: 10px 8px;">${auditorsText}</td>
					</tr>
					<tr>
						<td style="vertical-align: top; font-weight: 600; padding: 10px 8px; background-color: #f9fafb;">Denetlenen Firmadan Katılanlar</td>
						<td style="padding: 10px 8px;">${supplierAttendeesText}</td>
					</tr>
					<tr>
						<td style="vertical-align: top; font-weight: 600; padding: 10px 8px; background-color: #f9fafb;">Alınan Puan / Sınıf</td>
						<td style="padding: 10px 8px;">
							<div style="display: flex; align-items: center; gap: 15px;">
								<strong style="font-size: 1.3em; color: ${gradeInfo.color}; font-weight: 700;">${record.score ?? 'N/A'} Puan</strong>
								<span style="font-weight: 700; background-color: ${gradeInfo.color}; color: white; padding: 6px 14px; border-radius: 6px; font-size: 1.1em;">${gradeInfo.grade}</span>
								<span style="color: #4b5563; font-style: italic;">(${gradeInfo.description})</span>
							</div>
						</td>
					</tr>
					${record.notes && record.notes !== '-' ? `<tr>
						<td style="vertical-align: top; font-weight: 600; padding: 10px 8px; background-color: #f9fafb;">Denetim Notları</td>
						<td style="padding: 10px 8px;"><pre style="white-space: pre-wrap; margin: 0; font-family: inherit; background-color: #f3f4f6; padding: 10px; border-radius: 4px; border-left: 3px solid #3b82f6;">${record.notes}</pre></td>
					</tr>` : ''}
				`;
				break;
			}
			case 'internal_audit': {
				const st = record.status || '-';
				const draftNote =
					record.status && record.status !== 'Tamamlandı'
						? `<tr><td colspan="2" style="background:#fef3c7;padding:10px;border-radius:4px;border-left:4px solid #f59e0b;font-size:11px;">Bu tetkik henüz tamamlanmamıştır; özet sayımları geçici bilgidir. Cevaplanmamış sorular raporda «Bekliyor» olarak gösterilir.</td></tr>`
						: '';
				return `
						<tr><td>Tetkik Durumu</td><td><strong>${st}</strong></td></tr>
						<tr><td>İç Tetkik Standartı</td><td>${record.audit_standard ? `${record.audit_standard.code}-${record.audit_standard.name}` : '-'}</td></tr>
						<tr><td>Tetkik Başlığı</td><td>${record.title || '-'}</td></tr>
						<tr><td>Denetlenen Birim</td><td>${record.department?.unit_name || '-'}</td></tr>
						<tr><td>Tetkik Tarihi</td><td>${formatDate(record.audit_date)}</td></tr>
						<tr><td>Tetkikçi</td><td>${record.auditor_name || '-'}</td></tr>
						${draftNote}
					`;
				break;
			}
			case 'equipment': {
				const latestCalibration = record.equipment_calibrations?.sort((a, b) => new Date(b.calibration_date) - new Date(a.calibration_date))[0];
				return `
						<tr><td>Ekipman Adı</td><td>${record.name}</td></tr>
						<tr><td>Marka/Model</td><td>${record.brand_model || '-'}</td></tr>
						<tr><td>Sorumlu Birim</td><td>${record.responsible_unit}</td></tr>
						<tr><td>Son Kalibrasyon</td><td>${latestCalibration ? formatDate(latestCalibration.calibration_date) : '-'}</td></tr>
						<tr><td>Sonraki Kalibrasyon</td><td>${latestCalibration ? formatDate(latestCalibration.next_calibration_date) : '-'}</td></tr>
					`;
				break;
			}
			case 'equipment_scrap_certificate': {
				const esc = (s) => String(s ?? '-')
					.replace(/&/g, '&amp;')
					.replace(/</g, '&lt;')
					.replace(/>/g, '&gt;')
					.replace(/"/g, '&quot;');
				const reason = esc(record.scrap_reason || record.scrapReason || '-');
				return `
						<tr><td>Ekipman Adı</td><td>${esc(record.name)}</td></tr>
						<tr><td>Seri Numarası</td><td>${esc(record.serial_number)}</td></tr>
						<tr><td>Marka / Model</td><td>${esc(record.brand_model || '-')}</td></tr>
						<tr><td>Sorumlu Birim</td><td>${esc(record.responsible_unit || '-')}</td></tr>
						<tr><td>Konum</td><td>${esc(record.location || '-')}</td></tr>
						<tr><td>Hurda Ayırma Tarihi</td><td>${formatDate(record.scrap_date)}</td></tr>
						<tr><td>Hurda Ayırma Sebebi</td><td><pre style="white-space: pre-wrap; margin:0; font-family: inherit;">${reason}</pre></td></tr>
						<tr><td>Tutanağı Hazırlayan</td><td>${esc(record.scrap_prepared_by_name || '-')}</td></tr>
					`;
				break;
			}
			case 'incoming_control_plans': {
				// Girdi kontrol planı raporunu process control gibi okunaklı hale getir
				const itemsTableHtml = record.items && record.items.length > 0
					? `<table class="details-table" style="width: 100%; margin-top: 10px; border-collapse: collapse;">
					<thead>
						<tr style="background-color: #f3f4f6; border: 1px solid #d1d5db;">
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Sıra</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Karakteristik</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Ölçüm sıklığı</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Ölçüm Ekipmanı</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Standart</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Nominal Değer</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Min Tolerans</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Max Tolerans</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Tolerans Yönü</th>
						</tr>
					</thead>
					<tbody>
						${record.items.map((item, idx) => {
						// Karakteristik bilgilerini göster
						const characteristicName = item.characteristic_name || item.characteristic_id || '-';
						const characteristicType = item.characteristic_type ? `<div style="font-size: 0.85em; color: #6b7280; margin-top: 2px;">Tip: ${item.characteristic_type}</div>` : '';
						const toleranceInfo = item.tolerance_class ? `<div style="font-size: 0.85em; color: #6b7280; margin-top: 2px;">Tolerans: ${item.tolerance_class}</div>` : '';

						// Ölçüm ekipmanı bilgilerini göster
						const equipmentName = item.equipment_name || item.equipment_id || '-';

						// Standart bilgilerini göster-standard_class varsa onu göster, yoksa standard_name veya standard_id
						let standardName = '-';
						if (item.standard_class) {
							standardName = item.standard_class;
						} else if (item.standard_name) {
							standardName = item.standard_name;
						} else if (item.standard_id) {
							standardName = item.standard_id;
						}
						const standardInfo = item.tolerance_class && !item.standard_class ? `<div style="font-size: 0.85em; color: #6b7280; margin-top: 2px;">Sınıf: ${item.tolerance_class}</div>` : '';

						return `
								<tr style="border-bottom: 1px solid #d1d5db;">
									<td style="border: 1px solid #d1d5db; padding: 8px; font-weight: 600; text-align: center; background-color: #f9fafb;">${idx + 1}</td>
									<td style="border: 1px solid #d1d5db; padding: 8px;">
										<div style="font-weight: 600;">${characteristicName}</div>
										${characteristicType}
										${toleranceInfo}
									</td>
									<td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-weight: 600; white-space: nowrap;">${getMeasurementFrequencyLabel(item.characteristic_type)}</td>
									<td style="border: 1px solid #d1d5db; padding: 8px;">${equipmentName}</td>
									<td style="border: 1px solid #d1d5db; padding: 8px;">
										<div>${standardName}</div>
										${standardInfo}
									</td>
									<td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-weight: 600; background-color: #eff6ff; font-size: 1.05em;">${item.nominal_value || '-'}</td>
									<td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; background-color: #fef3c7; font-weight: 500;">${item.min_value || '-'}</td>
									<td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; background-color: #fef3c7; font-weight: 500;">${item.max_value || '-'}</td>
									<td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-weight: 600; font-size: 1.1em;">${item.tolerance_direction || '±'}</td>
								</tr>
							`;
					}).join('')}
					</tbody>
				</table>`
					: '<p style="color: #6b7280; padding: 20px; text-align: center;">Ölçüm noktası bulunamadı.</p>';

				const formatDate = (dateStr) => formatDateHelper(dateStr, 'dd.MM.yyyy');

				return `
				<tr><td>Parça Kodu</td><td><strong>${record.part_code || '-'}</strong></td></tr>
				<tr><td>Parça Adı</td><td><strong>${record.part_name || '-'}</strong></td></tr>
				<tr><td>Revizyon No</td><td>${record.revision_number || 0}</td></tr>
				<tr><td>Revizyon Tarihi</td><td>${record.revision_date ? formatDate(record.revision_date) : (record.updated_at ? formatDate(record.updated_at) : (record.created_at ? formatDate(record.created_at) : '-'))}</td></tr>
				<tr><td colspan="2"><h3 style="margin-top: 15px; margin-bottom: 10px; color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 5px;">ÖLÇÜLMESİ GEREKEN NOKTALAR VE ÖLÇÜLER</h3>${itemsTableHtml}</td></tr>
			`;
				break;
			}
			case 'process_control_plans': {
				// Ölçülmesi gereken noktalar ve ölçüleri net bir şekilde göster
				const itemsTableHtml = record.items && record.items.length > 0
					? `<table class="details-table" style="width: 100%; margin-top: 10px; border-collapse: collapse; table-layout: fixed;">
					<colgroup>
						<col style="width: 35px;">
						<col style="width: 14%;">
						<col style="width: 9%;">
						<col style="width: 14%;">
						<col style="width: 14%;">
						<col style="width: 7%;">
						<col style="width: 9%;">
						<col style="width: 9%;">
						<col style="width: 9%;">
						<col style="width: 35px;">
					</colgroup>
					<thead>
						<tr style="background-color: #f3f4f6; border: 1px solid #d1d5db;">
							<th style="border: 1px solid #d1d5db; padding: 6px 4px; text-align: center; font-size: 9px; font-weight: 600;">Sıra</th>
							<th style="border: 1px solid #d1d5db; padding: 6px 4px; text-align: left; font-size: 9px; font-weight: 600;">Karakteristik</th>
							<th style="border: 1px solid #d1d5db; padding: 6px 4px; text-align: center; font-size: 8px; font-weight: 600;">Sıklık</th>
							<th style="border: 1px solid #d1d5db; padding: 6px 4px; text-align: left; font-size: 9px; font-weight: 600;">Ölçüm Ekipmanı</th>
							<th style="border: 1px solid #d1d5db; padding: 6px 4px; text-align: left; font-size: 9px; font-weight: 600;">Standart</th>
							<th style="border: 1px solid #d1d5db; padding: 6px 4px; text-align: center; font-size: 8px; font-weight: 600;">Sac kal. (mm)</th>
							<th style="border: 1px solid #d1d5db; padding: 6px 4px; text-align: center; font-size: 9px; font-weight: 600;">Nominal Değer</th>
							<th style="border: 1px solid #d1d5db; padding: 6px 4px; text-align: center; font-size: 9px; font-weight: 600;">Min Tolerans</th>
							<th style="border: 1px solid #d1d5db; padding: 6px 4px; text-align: center; font-size: 9px; font-weight: 600;">Max Tolerans</th>
							<th style="border: 1px solid #d1d5db; padding: 6px 4px; text-align: center; font-size: 9px; font-weight: 600;">Tol. Yönü</th>
						</tr>
					</thead>
					<tbody>
						${record.items.map((item, idx) => {
						// Türkçe karakterleri korumak için güvenli metin encoding
						const safeText = (text) => {
							if (!text) return '-';
							// HTML entity encoding-sadece özel karakterleri encode et, Türkçe karakterleri koru
							return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
						};

						// Karakteristik bilgilerini göster
						const characteristicName = safeText(item.characteristic_name || item.characteristic_id || '-');
						const characteristicType = item.characteristic_type ? `<div style="font-size: 0.8em; color: #6b7280; margin-top: 2px; font-family: 'Noto Sans Turkish', 'Noto Sans', 'Roboto', 'Arial Unicode MS', sans-serif;">Tip: ${safeText(item.characteristic_type)}</div>` : '';
						const toleranceInfo = item.tolerance_class ? `<div style="font-size: 0.8em; color: #6b7280; margin-top: 2px; font-family: 'Noto Sans Turkish', 'Noto Sans', 'Roboto', 'Arial Unicode MS', sans-serif;">Tolerans: ${safeText(item.tolerance_class)}</div>` : '';

						// Ölçüm ekipmanı bilgilerini göster
						const equipmentName = safeText(item.equipment_name || item.equipment_id || '-');

						// Standart bilgilerini göster-standard_class varsa onu göster, yoksa standard_name veya standard_id
						let standardName = '-';
						if (item.standard_class) {
							// standard_class varsa direkt göster (TS 13920, TS 9013 gibi)
							standardName = safeText(item.standard_class);
						} else if (item.standard_name) {
							standardName = safeText(item.standard_name);
						} else if (item.standard_id) {
							standardName = safeText(item.standard_id);
						}
						const standardInfo = item.tolerance_class ? `<div style="font-size: 0.8em; color: #6b7280; margin-top: 2px; word-wrap: break-word; line-height: 1.3; font-family: 'Noto Sans Turkish', 'Noto Sans', 'Roboto', 'Arial Unicode MS', sans-serif;">Tolerans Sınıfı: ${safeText(item.tolerance_class)}</div>` : '';
						const frequencyLabel = safeText(getMeasurementFrequencyLabel(item.characteristic_type));

						return `
								<tr style="border-bottom: 1px solid #d1d5db;">
									<td style="border: 1px solid #d1d5db; padding: 6px 4px; font-weight: 600; text-align: center; background-color: #f9fafb; font-size: 9px; font-family: 'Noto Sans Turkish', 'Noto Sans', 'Roboto', 'Arial Unicode MS', sans-serif;">${idx + 1}</td>
									<td style="border: 1px solid #d1d5db; padding: 6px 4px; word-wrap: break-word; overflow-wrap: break-word; font-family: 'Noto Sans Turkish', 'Noto Sans', 'Roboto', 'Arial Unicode MS', sans-serif;">
										<div style="font-weight: 600; font-size: 9px;">${characteristicName}</div>
										${characteristicType}
										${toleranceInfo}
									</td>
									<td style="border: 1px solid #d1d5db; padding: 6px 4px; text-align: center; font-weight: 600; font-size: 9px; white-space: nowrap; font-family: 'Noto Sans Turkish', 'Noto Sans', 'Roboto', 'Arial Unicode MS', sans-serif;">${frequencyLabel}</td>
									<td style="border: 1px solid #d1d5db; padding: 6px 4px; word-wrap: break-word; overflow-wrap: break-word; font-size: 9px; font-family: 'Noto Sans Turkish', 'Noto Sans', 'Roboto', 'Arial Unicode MS', sans-serif;">${equipmentName}</td>
									<td style="border: 1px solid #d1d5db; padding: 6px 4px; word-wrap: break-word; overflow-wrap: break-word; font-size: 9px; line-height: 1.3; font-family: 'Noto Sans Turkish', 'Noto Sans', 'Roboto', 'Arial Unicode MS', sans-serif;">
										<div style="word-wrap: break-word; overflow-wrap: break-word;">${standardName}</div>
										${standardInfo}
									</td>
									<td style="border: 1px solid #d1d5db; padding: 6px 4px; text-align: center; font-size: 9px; font-family: 'Noto Sans Turkish', 'Noto Sans', 'Roboto', 'Arial Unicode MS', sans-serif;">${item.standard_class && String(item.standard_class).startsWith('TS 9013') ? (item.sheet_thickness_mm != null && item.sheet_thickness_mm !== '' ? safeText(String(item.sheet_thickness_mm)) : '-') : '-'}</td>
									<td style="border: 1px solid #d1d5db; padding: 6px 4px; text-align: center; font-weight: 600; background-color: #eff6ff; font-size: 9px; font-family: 'Noto Sans Turkish', 'Noto Sans', 'Roboto', 'Arial Unicode MS', sans-serif;">${item.nominal_value || '-'}</td>
									<td style="border: 1px solid #d1d5db; padding: 6px 4px; text-align: center; background-color: #fef3c7; font-weight: 500; font-size: 9px; font-family: 'Noto Sans Turkish', 'Noto Sans', 'Roboto', 'Arial Unicode MS', sans-serif;">${item.min_value || '-'}</td>
									<td style="border: 1px solid #d1d5db; padding: 6px 4px; text-align: center; background-color: #fef3c7; font-weight: 500; font-size: 9px; font-family: 'Noto Sans Turkish', 'Noto Sans', 'Roboto', 'Arial Unicode MS', sans-serif;">${item.max_value || '-'}</td>
									<td style="border: 1px solid #d1d5db; padding: 6px 4px; text-align: center; font-weight: 600; font-size: 10px; font-family: 'Noto Sans Turkish', 'Noto Sans', 'Roboto', 'Arial Unicode MS', sans-serif;">${item.tolerance_direction || '±'}</td>
								</tr>
							`;
					}).join('')}
					</tbody>
				</table>`
					: '<p style="color: #6b7280; padding: 20px; text-align: center;">Ölçüm noktası bulunamadı.</p>';

				let revisionNotesHtml = '';
				if (record.revision_number > 0 && record.revision_notes) {
					revisionNotesHtml = `
					<tr><td colspan="2">
						<div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #d1d5db;">
							<h3 style="margin-bottom: 10px; color: #1f2937; font-size: 1.1em;">REVİZYON NOTLARI</h3>
							<div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; border-left: 4px solid #3b82f6;">
								<p style="margin: 0; white-space: pre-wrap; line-height: 1.6;">${record.revision_notes}</p>
							</div>
						</div>
					</td></tr>
				`;
				}

				// Türkçe karakterleri korumak için güvenli metin encoding
				const encodeTurkishChars = (text) => {
					if (!text) return '-';
					// HTML entity encoding-sadece özel karakterleri encode et, Türkçe karakterleri koru
					return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
				};

				return `
				<tr><td>Araç Tipi</td><td><strong style="font-family: 'Noto Sans Turkish', 'Noto Sans', 'Roboto', 'Arial Unicode MS', sans-serif;">${encodeTurkishChars(record.vehicle_type)}</strong></td></tr>
				<tr><td>Parça Kodu</td><td><strong style="font-family: 'Noto Sans Turkish', 'Noto Sans', 'Roboto', 'Arial Unicode MS', sans-serif;">${encodeTurkishChars(record.part_code)}</strong></td></tr>
				<tr><td>Parça Adı</td><td><strong style="font-family: 'Noto Sans Turkish', 'Noto Sans', 'Roboto', 'Arial Unicode MS', sans-serif; word-wrap: break-word; overflow-wrap: break-word;">${encodeTurkishChars(record.part_name)}</strong></td></tr>
				<tr><td>Revizyon No</td><td>${record.revision_number || 0}</td></tr>
				<tr><td>Revizyon Tarihi</td><td>${formatDate(record.revision_date)}</td></tr>
				<tr><td colspan="2"><h3 style="margin-top: 15px; margin-bottom: 10px; color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 5px; font-family: 'Noto Sans Turkish', 'Noto Sans', 'Roboto', 'Arial Unicode MS', sans-serif;">ÖLÇÜLMESİ GEREKEN NOKTALAR VE ÖLÇÜLER</h3>${itemsTableHtml}</td></tr>
				${revisionNotesHtml}
			`;
				break;
			}
			case 'inkr_management': {
				// Ölçüm sonuçları tablosu
				const itemsTableHtml = record.items && record.items.length > 0
					? `<table class="info-table results-table" style="width: 100%; margin-top: 15px; border-collapse: collapse;">
					<thead>
						<tr style="background-color: #f3f4f6; border-bottom: 2px solid #d1d5db;">
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-size: 11px; font-weight: 600;">#</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 11px; font-weight: 600;">Karakteristik</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 11px; font-weight: 600;">Yöntem</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 11px; font-weight: 600;">Standart / Sınıf</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-size: 11px; font-weight: 600;">Nominal</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-size: 11px; font-weight: 600;">Min</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-size: 11px; font-weight: 600;">Max</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-size: 11px; font-weight: 600;">Ölçülen</th>
							<th style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-size: 11px; font-weight: 600;">Sonuç</th>
						</tr>
					</thead>
					<tbody>
						${record.items.map((item, idx) => {
						const safeText = (text) => {
							if (!text) return '-';
							return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
						};

						const characteristicName = safeText(item.characteristic_name || item.characteristic_id || '-');
						const methodName = safeText(item.measurement_method || item.equipment_name || item.equipment_id || '-');
						const standardClass = safeText(item.standard_label || item.standard_class || item.tolerance_class || '-');
						const nominal = safeText(item.nominal_value || '-');
						const min = safeText(item.min_value || '-');
						const max = safeText(item.max_value || '-');
						const measured = safeText(item.measured_value || '-');

						//                            // Sonuç hesaplama
						let resultHtml = '<span style="color: #6b7280;">-</span>';

						if (item.measured_value !== null && item.measured_value !== undefined && item.measured_value !== '') {
							const valStr = String(item.measured_value).trim().toUpperCase();
							const nominalValStr = item.nominal_value ? String(item.nominal_value).trim().toUpperCase() : '';

							const normalizedVal = valStr.replace(',', '.');
							const measuredVal = parseFloat(normalizedVal);
							const minVal = parseFloat(String(item.min_value || '').replace(',', '.'));
							const maxVal = parseFloat(String(item.max_value || '').replace(',', '.'));

							// 1. KESİN RED KELİMELERİ
							const isExplicitFail = ['RET', 'UYGUNSUZ', 'NOK', 'NG', 'HATALI', 'RED'].some(failText =>
								valStr === failText || valStr.startsWith(failText + ' ')
							);

							// 2. KESİN KABUL KELİMELERİ
							const isExplicitPass = ['OK', 'UYGUN', 'KABUL', 'PASS', 'GEÇER', 'VAR', 'EVET'].some(okText =>
								valStr === okText || valStr.startsWith(okText + ' ')
							);

							let isCompliant = false;

							if (isExplicitFail) {
								isCompliant = false;
							} else if (isExplicitPass) {
								isCompliant = true;
							} else if (nominalValStr && valStr === nominalValStr) {
								// 3. NOMİNAL DEĞER İLE BİREBİR EŞLEŞME (Metin olarak)
								isCompliant = true;
							} else if (!isNaN(measuredVal)) {
								// 4. SAYISAL KONTROL
								if (!isNaN(minVal) && !isNaN(maxVal)) {
									isCompliant = measuredVal >= minVal && measuredVal <= maxVal;
								} else if (!isNaN(minVal)) {
									isCompliant = measuredVal >= minVal;
								} else if (!isNaN(maxVal)) {
									isCompliant = measuredVal <= maxVal;
								} else {
									// Sayısal değer var ama limit yoksa ve nominal de eşleşmediyse
									// Eğer nominal değer sayısal ise ve eşitse kabul et
									const nominalNum = parseFloat(String(item.nominal_value || '').replace(',', '.'));
									if (!isNaN(nominalNum) && measuredVal === nominalNum) {
										isCompliant = true;
									}
								}
							}

							if (isCompliant) {
								resultHtml = '<span style="background-color: #d1fae5; color: #065f46; padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 10px;">KABUL</span>';
							} else {
								resultHtml = '<span style="background-color: #fee2e2; color: #991b1b; padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 10px;">RET</span>';
							}
						}

						return `
						<tr style="border-bottom: 1px solid #e5e7eb;">
							<td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-size: 11px;">${idx + 1}</td>
							<td style="border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 11px;">${characteristicName}</td>
							<td style="border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 11px;">${methodName}</td>
							<td style="border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 11px;">${standardClass}</td>
							<td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-size: 11px; font-weight: 600;">${nominal}</td>
							<td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-size: 11px;">${min}</td>
							<td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-size: 11px;">${max}</td>
							<td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-size: 11px; font-weight: 600;">${measured}</td>
							<td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-size: 11px;">${resultHtml}</td>
						</tr>
						`;
					}).join('')}
					</tbody>
				</table>`
					: '<p style="color: #6b7280; margin-top: 15px;">Ölçüm sonucu bulunamadı.</p>';

				// INKR numarası-varsa göster, yoksa parça kodundan oluştur
				let displayInkrNumber = '-';
				if (record.inkr_number && record.inkr_number.startsWith('INKR-')) {
					displayInkrNumber = record.inkr_number;
				} else if (record.part_code) {
					// Parça kodundan INKR numarası oluştur
					const cleanPartCode = record.part_code.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
					displayInkrNumber = `INKR-${cleanPartCode} `;
				}

				return `
				<tr><td>INKR Numarası</td><td>${displayInkrNumber}</td></tr>
				<tr><td>Ürün Adı</td><td>${record.part_name || '-'}</td></tr>
				<tr><td>Ürün Kodu</td><td>${record.part_code || '-'}</td></tr>
				<tr><td>Tedarikçi</td><td>${record.supplier_name || record.supplier?.name || '-'}</td></tr>
				<tr><td>Rapor Tarihi</td><td>${formatDate(record.report_date || record.created_at)}</td></tr>
				<tr><td>Durum</td><td>${record.status || 'Aktif'}</td></tr>
				<tr><td colspan="2"><h3 style="margin-top: 15px; margin-bottom: 10px; color: #1e40af;">Ölçüm Sonuçları</h3>${itemsTableHtml}</td></tr>
				${record.notes ? `<tr><td>Notlar</td><td><pre style="white-space: pre-wrap; font-family: inherit;">${record.notes}</pre></td></tr>` : ''}
`;
				break;
			}
			case 'stock_risk_controls': {
				const riskLevelColor = {
					'Yüksek': '#dc2626',
					'Orta': '#f59e0b',
					'Düşük': '#16a34a',
				};
				const color = riskLevelColor[record.decision] || '#6b7280';

				// Build results table if exists
				const resultsTableHtml = record.results && Array.isArray(record.results) && record.results.length > 0
					? `
	< tr > <td colspan="2"><h4 style="margin: 10px 0;">Kontrol Sonuçları</h4>
		<table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
			<thead>
				<tr style="background-color: #f3f4f6;">
					<th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Ölçüm Türü</th>
					<th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Değer</th>
					<th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Sonuç</th>
				</tr>
			</thead>
			<tbody>
				${record.results.map(r => `
									<tr>
										<td style="border: 1px solid #d1d5db; padding: 8px;">${r.measurement_type || '-'}</td>
										<td style="border: 1px solid #d1d5db; padding: 8px;">${r.value || '-'}</td>
										<td style="border: 1px solid #d1d5db; padding: 8px;">${r.result || '-'}</td>
									</tr>
								`).join('')}
			</tbody>
		</table>
	</td></tr >
		`
					: '';

				return `
		< tr ><td>Parça Kodu</td><td>${record.part_code || '-'}</td></tr >
				<tr><td>Parça Adı</td><td>${record.part_name || '-'}</td></tr>
				<tr><td>Tedarikçi</td><td>${record.supplier?.name || '-'}</td></tr>
				<tr><td>Kaynak GKK No</td><td>${record.source_inspection?.record_no || '-'}</td></tr>
				<tr><td>Kontrol Edilen GKK No</td><td>${record.controlled_inspection?.record_no || '-'}</td></tr>
				<tr><td>Karar</td><td><strong style="color: ${color}; font-size: 1.1em;">${record.decision || '-'}</strong></td></tr>
				<tr><td>Kontrol Tarihi</td><td>${formatDateHelper(record.created_at)}</td></tr>
				<tr><td>Kontrol Eden</td><td>${record.controlled_by?.full_name || '-'}</td></tr>
				${resultsTableHtml}
				${record.notes ? `<tr><td>Notlar</td><td><pre style="background-color: #f3f4f6; padding: 10px; border-radius: 4px;">${record.notes}</pre></td></tr>` : ''}
`;
				break;
			}
			default: return `< tr ><td>Detaylar</td><td>Bu modül için özel rapor formatı tanımlanmamış.</td></tr > `;
		}
	};

	const getAdditionalSections = async () => {
		let html = '';

		// Problem Tanımı (nonconformity için-eğer getGeneralInfo'dan gelmediyse)
		const generalInfo = getGeneralInfo();
		const hasProblemDescription = typeof generalInfo === 'object' && generalInfo.problemDescription;
		let sectionNumber = hasProblemDescription ? '3' : '2';

		// İlerleme Notları / Yapılan Çalışmalar (Tüm uygunsuzluklar için)
		if (type === 'nonconformity' && record.closing_notes) {
			html += `<div class="section" >
				<h2 class="section-title blue">${sectionNumber}. İLERLEME NOTLARI / YAPILAN ÇALIŞMALAR</h2>
				<div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; border-radius: 4px; margin-top: 10px;">
					<pre style="white-space: pre-wrap; word-wrap: break-word; font-family: inherit; margin: 0;">${record.closing_notes}</pre>
				</div>
			</div> `;
		}

		// Karantina İşlem Geçmişi
		if (type === 'quarantine' && record.history && record.history.length > 0) {
			html += `<div class="section" >
				<h2 class="section-title green">2. İŞLEM GEÇMİŞİ</h2>
				<table class="results-table">
					<thead>
						<tr>
							<th style="width: 15%;">Tarih</th>
							<th style="width: 15%;">Karar</th>
							<th style="width: 10%;">İşlenen Miktar</th>
							<th style="width: 60%;">Notlar</th>
						</tr>
					</thead>
					<tbody>
						${record.history.map(h => `
							<tr>
								<td style="white-space: nowrap;">${formatDateTime(h.decision_date)}</td>
								<td><strong>${h.decision || '-'}</strong></td>
								<td style="text-align: right;">${h.processed_quantity || '-'}</td>
								<td><pre style="white-space: pre-wrap; font-family: inherit; margin: 0; font-size: 9px;">${h.notes || '-'}</pre></td>
							</tr>
						`).join('')}
					</tbody>
				</table>
			</div> `;
		}

		// Karantina ürün ekleri (görsel / PDF)
		if (type === 'quarantine') {
			const qAtts = normalizeQuarantineAttachments(record.attachments);
			if (qAtts.length > 0) {
				const esc = (s) => String(s || '')
					.replace(/&/g, '&amp;')
					.replace(/</g, '&lt;')
					.replace(/"/g, '&quot;');
				const sectionNum = record.history && record.history.length > 0 ? '3' : '2';
				html += `<div class="section"><h2 class="section-title blue">${sectionNum}. ÜRÜN EKLERİ (GÖRSEL / PDF)</h2><div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start;margin-top:10px;">`;
				for (const att of qAtts) {
					let url = att.public_url || '';
					if (!url && att.path) {
						const { data } = supabase.storage.from('quarantine_documents').getPublicUrl(att.path);
						url = data?.publicUrl || '';
					}
					const isImg =
						(att.mime_type && String(att.mime_type).startsWith('image/')) ||
						/\.(jpe?g|png|gif|webp|bmp)$/i.test(att.name || '');
					if (isImg && url) {
						html += `<div style="flex:0 0 auto;max-width:300px;text-align:center;"><img src="${url}" alt="" style="max-width:280px;max-height:260px;border:1px solid #d1d5db;border-radius:6px;object-fit:contain;background:#f9fafb;" crossorigin="anonymous" /><div style="font-size:10px;margin-top:6px;color:#4b5563;font-weight:500;">${esc(att.name)}</div></div>`;
					} else if (url) {
						html += `<div style="margin:6px 0;"><a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:underline;">${esc(att.name || 'PDF / dosya')}</a></div>`;
					} else {
						html += `<div style="font-size:11px;color:#6b7280;">${esc(att.name || 'Dosya')} (URL yok)</div>`;
					}
				}
				html += `</div></div>`;
			}
		}

		// Kök Neden Analizleri (her zaman göster-doldurulabilir alanlar için)
		if (type === 'nonconformity') {
			// Problem tanımı artık 2. section, bu yüzden numaraları güncelle
			let sectionNumber = record.closing_notes ? '4' : '3';
			if (record.eight_d_steps) {
				sectionNumber = record.closing_notes ? '5' : '4';
			}

			html += `<div class="section" > <h2 class="section-title red">${sectionNumber}. KÖK NEDEN ANALİZİ</h2>`;

			// HTML escape fonksiyonu (güvenlik ve doğru gösterim için)
			const escapeHtml = (text) => {
				if (!text) return '';
				return String(text)
					.replace(/&/g, '&amp;')
					.replace(/</g, '&lt;')
					.replace(/>/g, '&gt;')
					.replace(/"/g, '&quot;')
					.replace(/'/g, '&#39;')
					.replace(/\n/g, '<br>');
			};

			// Veri varsa göster, yoksa boş alan göster
			const renderField = (value, emptyPattern) => {
				// null, undefined, boş string kontrolü
				if (value === null || value === undefined) {
					return '';
				}
				// String'e çevir ve trim yap
				const strValue = String(value).trim();
				if (strValue !== '' && strValue !== 'null' && strValue !== 'undefined') {
					return escapeHtml(strValue);
				}
				return ''; // Boş alanlar için alt çizgi karakterleri kaldırıldı, CSS border-bottom kullanılıyor
			};

			// 5N1K Analizi-Her zaman göster
			const fiveN1K = record.five_n1k_analysis || {};
			// Türkçe ve İngilizce alan adlarını destekle
			const get5N1KValue = (field) => {
				return fiveN1K[field] || fiveN1K[field === 'what' ? 'ne' :
					field === 'where' ? 'nerede' :
						field === 'when' ? 'neZaman' :
							field === 'who' ? 'kim' :
								field === 'how' ? 'nasil' :
									field === 'why' ? 'neden' : field] || '';
			};
			html += `<div class="analysis-box fillable" >
				<h4>5N1K Analizi</h4>
				<div class="fillable-field">
					<strong>Ne:</strong>
					<div class="fillable-line">${renderField(get5N1KValue('what'), '')}</div>
				</div>
				<div class="fillable-field">
					<strong>Nerede:</strong>
					<div class="fillable-line">${renderField(get5N1KValue('where'), '')}</div>
				</div>
				<div class="fillable-field">
					<strong>Ne Zaman:</strong>
					<div class="fillable-line">${renderField(get5N1KValue('when'), '')}</div>
				</div>
				<div class="fillable-field">
					<strong>Kim:</strong>
					<div class="fillable-line">${renderField(get5N1KValue('who'), '')}</div>
				</div>
				<div class="fillable-field">
					<strong>Nasıl:</strong>
					<div class="fillable-line">${renderField(get5N1KValue('how'), '')}</div>
				</div>
				<div class="fillable-field">
					<strong>Neden Önemli:</strong>
					<div class="fillable-line">${renderField(get5N1KValue('why'), '')}</div>
				</div>
			</div> `;

			// 5 Neden Analizi-Her zaman göster
			const fiveWhy = record.five_why_analysis || {};
			html += `<div class="analysis-box fillable" >
				<h4>5 Neden Analizi</h4>
				<div class="fillable-field">
					<strong>1. Neden:</strong>
					<div class="fillable-line">${renderField(fiveWhy.why1, '')}</div>
				</div>
				<div class="fillable-field">
					<strong>2. Neden:</strong>
					<div class="fillable-line">${renderField(fiveWhy.why2, '')}</div>
				</div>
				<div class="fillable-field">
					<strong>3. Neden:</strong>
					<div class="fillable-line">${renderField(fiveWhy.why3, '')}</div>
				</div>
				<div class="fillable-field">
					<strong>4. Neden:</strong>
					<div class="fillable-line">${renderField(fiveWhy.why4, '')}</div>
				</div>
				<div class="fillable-field">
					<strong>5. Neden (Kök Neden):</strong>
					<div class="fillable-line">${renderField(fiveWhy.why5, '')}</div>
				</div>
				<div class="fillable-field">
					<strong>Kök Neden Özeti:</strong>
					<div class="fillable-area">${renderField(fiveWhy.rootCause, '')}</div>
				</div>
				<div class="fillable-field">
					<strong>Anlık Aksiyon:</strong>
					<div class="fillable-area">${renderField(fiveWhy.immediateAction, '')}</div>
				</div>
				<div class="fillable-field">
					<strong>Önleyici Aksiyon:</strong>
					<div class="fillable-area">${renderField(fiveWhy.preventiveAction, '')}</div>
				</div>
			</div> `;

			// Ishikawa (Balık Kılçığı) Analizi-Her zaman göster
			const ishikawa = record.ishikawa_analysis || {};
			// Ishikawa verileri array olarak saklanabilir, string'e çevir
			const getIshikawaValue = (field) => {
				const value = ishikawa[field];
				if (!value) return '';
				if (Array.isArray(value)) {
					return value.filter(v => v && v.toString().trim() !== '').join(', ');
				}
				return value.toString();
			};
			html += `<div class="analysis-box fillable" >
				<h4>Ishikawa (Balık Kılçığı) Analizi-6M</h4>
				<div class="fillable-field">
					<strong>İnsan (Man):</strong>
					<div class="fillable-area">${renderField(getIshikawaValue('man'), '')}</div>
				</div>
				<div class="fillable-field">
					<strong>Makine (Machine):</strong>
					<div class="fillable-area">${renderField(getIshikawaValue('machine'), '')}</div>
				</div>
				<div class="fillable-field">
					<strong>Metot (Method):</strong>
					<div class="fillable-area">${renderField(getIshikawaValue('method') || getIshikawaValue('management'), '')}</div>
				</div>
				<div class="fillable-field">
					<strong>Malzeme (Material):</strong>
					<div class="fillable-area">${renderField(getIshikawaValue('material'), '')}</div>
				</div>
				<div class="fillable-field">
					<strong>Çevre (Environment):</strong>
					<div class="fillable-area">${renderField(getIshikawaValue('environment'), '')}</div>
				</div>
				<div class="fillable-field">
					<strong>Ölçüm (Measurement):</strong>
					<div class="fillable-area">${renderField(getIshikawaValue('measurement'), '')}</div>
				</div>
			</div> `;

			// FTA (Hata Ağacı) Analizi-Her zaman göster
			const fta = record.fta_analysis || {};
			// FTA verileri events array'i olarak saklanabilir, string formatına çevir
			const getFTAValue = (field) => {
				if (field === 'intermediateEvents' || field === 'basicEvents' || field === 'gates' || field === 'rootCauses') {
					// Eğer events array'i varsa, ilgili event'leri filtrele ve birleştir
					if (fta.events && Array.isArray(fta.events)) {
						const filteredEvents = fta.events.filter(e => {
							if (field === 'intermediateEvents') return e.type === 'intermediate';
							if (field === 'basicEvents') return e.type === 'basic';
							if (field === 'rootCauses') return e.type === 'basic' && e.causes && e.causes.length > 0;
							return false;
						});
						if (field === 'gates') {
							return fta.events.map(e => e.gate || '').filter(g => g).join(', ');
						}
						if (field === 'rootCauses') {
							const causes = [];
							fta.events.forEach(e => {
								if (e.causes && Array.isArray(e.causes)) {
									causes.push(...e.causes.filter(c => c && c.toString().trim() !== ''));
								}
							});
							return causes.join(', ');
						}
						return filteredEvents.map(e => e.description || '').filter(d => d).join(', ');
					}
				}
				return fta[field] || '';
			};
			html += `<div class="analysis-box fillable" >
				<h4>FTA (Hata Ağacı) Analizi</h4>
				<div class="fillable-field">
					<strong>Üst Olay:</strong>
					<div class="fillable-line">${renderField(fta.topEvent || getFTAValue('topEvent'), '')}</div>
				</div>
				<div class="fillable-field">
					<strong>Ara Olaylar:</strong>
					<div class="fillable-area">${renderField(fta.intermediateEvents || getFTAValue('intermediateEvents'), '')}</div>
				</div>
				<div class="fillable-field">
					<strong>Temel Olaylar:</strong>
					<div class="fillable-area">${renderField(fta.basicEvents || getFTAValue('basicEvents'), '')}</div>
				</div>
				<div class="fillable-field">
					<strong>Kapılar:</strong>
					<div class="fillable-area">${renderField(fta.gates || getFTAValue('gates'), '')}</div>
				</div>
				<div class="fillable-field">
					<strong>Kök Nedenler:</strong>
					<div class="fillable-area">${renderField(fta.rootCauses || getFTAValue('rootCauses'), '')}</div>
				</div>
				<div class="fillable-field">
					<strong>Özet:</strong>
					<div class="fillable-area">${renderField(fta.summary, '')}</div>
				</div>
			</div> `;

			html += `</div> `;

			if (record.eight_d_steps) {
				let sectionNumber8d = record.closing_notes ? '4' : '3';
				const hasAnalysis8d = (record.five_why_analysis && Object.values(record.five_why_analysis).some(v => v && v.toString().trim() !== '')) ||
					(record.five_n1k_analysis && Object.values(record.five_n1k_analysis).some(v => v && v.toString().trim() !== '')) ||
					(record.ishikawa_analysis && Object.values(record.ishikawa_analysis).some(v => v && v.toString().trim() !== '')) ||
					(record.fta_analysis && Object.values(record.fta_analysis).some(v => v && v.toString().trim() !== ''));
				if (hasAnalysis8d) {
					sectionNumber8d = record.closing_notes ? '5' : '4';
				}
				html += `<div class="section" > <h2 class="section-title red">${sectionNumber8d}. 8D ADIMLARI</h2>`;
				Object.entries(record.eight_d_steps).forEach(([key, step]) => {
					const stepDescHtml = renderField(stripSquareBullets(step.description || ''), '') || '-';
					html += `<div class="step-section" >
					<h3 class="step-title">${escapeHtml(key)}: ${escapeHtml(stripSquareBullets(step.title || ''))}</h3>
					<p><strong>Sorumlu:</strong> ${escapeHtml(stripSquareBullets(step.responsible || '-'))}</p>
					<p><strong>Tarih:</strong> ${formatDate(step.completionDate)}</p>
					<div class="step-description"><strong>Açıklama:</strong> <div class="step-description-body">${stepDescHtml}</div></div>
				</div> `;
				});
				html += `</div> `;
			}
		}
		if (type === 'deviation' && record.deviation_approvals?.length > 0) {
			// Deviation için description varsa 3. section, yoksa 2. section
			const generalInfo = getGeneralInfo();
			const hasDescription = typeof generalInfo === 'object' && generalInfo.problemDescription;
			const sectionNumber = hasDescription ? '3' : '2';
			html += `<div class="section" ><h2 class="section-title red">${sectionNumber}. ONAY SÜRECİ</h2><table class="info-table"><tbody>`;
			record.deviation_approvals.forEach(approval => {
				const notesHtml = approval.notes && approval.notes.trim() ? `<br><i>"${approval.notes}"</i>` : '';
				html += `<tr><td>${approval.approval_stage}</td><td>${approval.approver_name || 'Bekleniyor'}-<strong>${approval.status}</strong>${notesHtml}</td></tr>`;
			});
			html += `</tbody></table></div> `;
		}
		if (type === 'kaizen') {
			const analysis_5n1k = record.analysis_5n1k || {};
			const analysis_5_whys = record.analysis_5_whys || {};
			const analysis_fishbone = record.analysis_fishbone || {};
			html += `
	<div class="section" >
					<h2 class="section-title red">2. KÖK NEDEN ANALİZİ</h2>
					<div class="analysis-box">
						<h4>5N1K Analizi</h4>
						<p><strong>Ne:</strong> ${analysis_5n1k.what || '-'}</p>
						<p><strong>Nerede:</strong> ${analysis_5n1k.where || '-'}</p>
						<p><strong>Ne Zaman:</strong> ${analysis_5n1k.when || '-'}</p>
						<p><strong>Kim:</strong> ${analysis_5n1k.who || '-'}</p>
						<p><strong>Nasıl:</strong> ${analysis_5n1k.how || '-'}</p>
						<p><strong>Neden Önemli:</strong> ${analysis_5n1k.why || '-'}</p>
					</div>
					<div class="analysis-box">
						<h4>5 Neden Analizi</h4>
						<p><strong>1. Neden:</strong> ${analysis_5_whys.answer1 || '-'}</p>
						<p><strong>2. Neden:</strong> ${analysis_5_whys.answer2 || '-'}</p>
						<p><strong>3. Neden:</strong> ${analysis_5_whys.answer3 || '-'}</p>
						<p><strong>4. Neden:</strong> ${analysis_5_whys.answer4 || '-'}</p>
						<p><strong>5. Neden (Kök Neden):</strong> ${analysis_5_whys.answer5 || '-'}</p>
					</div>
					<div class="analysis-box">
						<h4>Balık Kılçığı Analizi</h4>
						<p><strong>İnsan:</strong> ${analysis_fishbone.man || '-'}</p>
						<p><strong>Makine:</strong> ${analysis_fishbone.machine || '-'}</p>
						<p><strong>Metot:</strong> ${analysis_fishbone.method || '-'}</p>
						<p><strong>Malzeme:</strong> ${analysis_fishbone.material || '-'}</p>
						<p><strong>Çevre:</strong> ${analysis_fishbone.environment || '-'}</p>
						<p><strong>Ölçüm:</strong> ${analysis_fishbone.measurement || '-'}</p>
					</div>
				</div>
	<div class="section">
		<h2 class="section-title green">3. ÇÖZÜM VE KAZANÇLAR</h2>
		<table class="info-table">
			<tbody>
				<tr><td>Uygulanan Çözüm</td><td><pre>${record.solution_description || '-'}</pre></td></tr>
				<tr><td>Aylık Kazanç</td><td>${formatCurrency(record.total_monthly_gain)}</td></tr>
				<tr><td>Yıllık Kazanç</td><td>${formatCurrency(record.total_yearly_gain)}</td></tr>
				<tr><td>İSG Etkileri</td><td>${formatArray(record.isg_effect)}</td></tr>
				<tr><td>Çevresel Etkiler</td><td>${formatArray(record.environmental_effect)}</td></tr>
			</tbody>
		</table>
	</div>
`;
		}

		if (type === 'supplier_audit' || type === 'internal_audit') {
			// Denetim sonuçlarını doğru formatta işle
			const results = record.audit_results || record.results || [];

			// Eğer results bir obje ise (question_id: {answer, notes} formatında), array'e çevir
			let resultsArray = [];
			if (results && typeof results === 'object' && !Array.isArray(results)) {
				// Object formatındaysa, questions ile birleştir
				const questionsFromContext = record.questions || [];
				Object.entries(results).forEach(([questionId, resultData]) => {
					const question = questionsFromContext.find(q => q.id === questionId);
					if (question && resultData) {
						resultsArray.push({
							question_text: question.question_text || 'Soru metni bulunamadı',
							answer: resultData.answer,
							notes: resultData.notes,
							points: question.points || 0,
							category: question.category || ''
						});
					}
				});
			} else if (Array.isArray(results)) {
				resultsArray = results;
			}

			if (resultsArray.length > 0) {
				html += `<div class="section" > <h2 class="section-title red">2. DENETİM SONUÇLARI VE BULGULAR</h2>`;

				// Kategori bazlı gruplama
				const categorizedResults = {};
				resultsArray.forEach((result) => {
					if (result) {
						const category = result.category || 'Genel';
						if (!categorizedResults[category]) {
							categorizedResults[category] = [];
						}
						categorizedResults[category].push(result);
					}
				});

				// Her kategori için tablo oluştur
				Object.entries(categorizedResults).forEach(([category, categoryResults]) => {
					html += `<h3 style = "font-size: 1.1em; font-weight: 700; color: #1f2937; margin-top: 15px; margin-bottom: 10px; padding: 8px; background-color: #f3f4f6; border-left: 4px solid #2563eb;" > ${category}</h3 > `;
					// İç tetkik için puan sütunu yok, tedarikçi denetimi için var
					if (type === 'internal_audit') {
						html += `<table class="info-table results-table" style = "margin-bottom: 20px;" ><thead><tr><th style="width: 50%;">Soru</th><th style="width: 15%;">Cevap</th><th style="width: 35%;">Denetçi Notları / Bulgular</th></tr></thead><tbody>`;
					} else {
						html += `<table class="info-table results-table" style="margin-bottom: 20px;"><thead><tr><th style="width: 10%;">Puan</th><th style="width: 40%;">Soru</th><th style="width: 15%;">Cevap</th><th style="width: 35%;">Denetçi Notları / Bulgular</th></tr></thead><tbody>`;
					}

					categoryResults.forEach((result) => {
						const answerValue = result.answer;
						const isPendingEmpty =
							type === 'internal_audit' &&
							(answerValue == null || String(answerValue).trim() === '');
						const displayAnswer = isPendingEmpty ? 'Bekliyor' : answerValue || '-';
						let answerColor = '#6b7280';
						let answerBg = '#f3f4f6';
						if (isPendingEmpty) {
							answerColor = '#6b7280';
							answerBg = '#e5e7eb';
						} else if (answerValue === 'Evet' || answerValue === 'Uygun') {
							answerColor = '#16a34a';
							answerBg = '#d1fae5';
						} else if (answerValue === 'Hayır' || answerValue === 'Uygunsuz') {
							answerColor = '#dc2626';
							answerBg = '#fee2e2';
						} else if (answerValue === 'Kısmen' || answerValue === 'Gözlem') {
							answerColor = '#f59e0b';
							answerBg = '#fef3c7';
						} else if (answerValue === 'Uygulanamaz') {
							answerColor = '#6b7280';
							answerBg = '#e5e7eb';
						}

						// İç tetkik için puan sütunu yok
						if (type === 'internal_audit') {
							html += `<tr style="vertical-align: top;">
								<td style="line-height: 1.5;">${result.question_text || '-'}</td>
								<td style="text-align: center;">
									<span style="display: inline-block; padding: 4px 12px; border-radius: 6px; font-weight: 700; font-size: 0.9em; background-color: ${answerBg}; color: ${answerColor};">
										${displayAnswer}
									</span>
								</td>
								<td><pre style="white-space: pre-wrap; word-wrap: break-word; margin: 0; font-family: inherit; line-height: 1.4; font-size: 9px; background-color: #fafafa; padding: 8px; border-radius: 4px; border-left: 3px solid ${answerColor};">${result.notes || 'Not bulunmuyor.'}</pre></td>
							</tr>`;
						} else {
							html += `<tr style="vertical-align: top;">
								<td style="text-align: center; font-weight: bold; color: #2563eb;">${result.points || 0}</td>
								<td style="line-height: 1.5;">${result.question_text || '-'}</td>
								<td style="text-align: center;">
									<span style="display: inline-block; padding: 4px 12px; border-radius: 6px; font-weight: 700; font-size: 0.9em; background-color: ${answerBg}; color: ${answerColor};">
										${answerValue || '-'}
									</span>
								</td>
								<td><pre style="white-space: pre-wrap; word-wrap: break-word; margin: 0; font-family: inherit; line-height: 1.4; font-size: 9px; background-color: #fafafa; padding: 8px; border-radius: 4px; border-left: 3px solid ${answerColor};">${result.notes || 'Not bulunmuyor.'}</pre></td>
							</tr>`;
						}
					});
					html += `</tbody></table> `;
				});

				// Özet İstatistikler
				const totalQuestions = resultsArray.length;
				// İç tetkik için cevaplar: 'Uygun', 'Uygunsuz', 'Gözlem', 'Kısmen Uygun', 'Uygulanamaz'
				// Tedarikçi tetkik için cevaplar: 'Evet', 'Hayır', 'Kısmen', 'Uygulanamaz'
				let yesCount, noCount, partialCount, naCount;
				let pendingCount = 0;
				if (type === 'internal_audit') {
					yesCount = resultsArray.filter(r => r.answer === 'Uygun').length;
					noCount = resultsArray.filter(r => r.answer === 'Uygunsuz').length;
					partialCount = resultsArray.filter(r => r.answer === 'Gözlem' || r.answer === 'Kısmen Uygun' || r.answer === 'Kısmen').length;
					naCount = resultsArray.filter(r => r.answer === 'Uygulanamaz').length;
					pendingCount = resultsArray.filter(r => r.answer == null || String(r.answer).trim() === '').length;
				} else {
					yesCount = resultsArray.filter(r => r.answer === 'Evet' || r.answer === 'Uygun').length;
					noCount = resultsArray.filter(r => r.answer === 'Hayır' || r.answer === 'Uygunsuz').length;
					partialCount = resultsArray.filter(r => r.answer === 'Kısmen' || r.answer === 'Gözlem' || r.answer === 'Kısmen Uygun').length;
					naCount = resultsArray.filter(r => r.answer === 'Uygulanamaz').length;
				}

				const summaryCols = type === 'internal_audit' ? 6 : 5;
				html += `<div style = "margin-top: 20px; padding: 15px; background-color: #eff6ff; border-radius: 8px; border: 2px solid #3b82f6;" >
					<h4 style="margin: 0 0 10px 0; color: #1e40af; font-size: 1.1em;">Denetim Özeti</h4>
					<div style="display: grid; grid-template-columns: repeat(${summaryCols}, 1fr); gap: 10px; text-align: center;">
						<div style="padding: 10px; background: white; border-radius: 6px;">
							<div style="font-size: 1.5em; font-weight: 700; color: #2563eb;">${totalQuestions}</div>
							<div style="font-size: 0.85em; color: #6b7280;">Toplam Soru</div>
						</div>
						<div style="padding: 10px; background: #d1fae5; border-radius: 6px;">
							<div style="font-size: 1.5em; font-weight: 700; color: #16a34a;">${yesCount}</div>
							<div style="font-size: 0.85em; color: #065f46;">Uygun</div>
						</div>
						<div style="padding: 10px; background: #fee2e2; border-radius: 6px;">
							<div style="font-size: 1.5em; font-weight: 700; color: #dc2626;">${noCount}</div>
							<div style="font-size: 0.85em; color: #991b1b;">Uygunsuz</div>
						</div>
						<div style="padding: 10px; background: #fef3c7; border-radius: 6px;">
							<div style="font-size: 1.5em; font-weight: 700; color: #f59e0b;">${partialCount}</div>
							<div style="font-size: 0.85em; color: #92400e;">Kısmen</div>
						</div>
						<div style="padding: 10px; background: #e5e7eb; border-radius: 6px;">
							<div style="font-size: 1.5em; font-weight: 700; color: #6b7280;">${naCount}</div>
							<div style="font-size: 0.85em; color: #374151;">Uygulanamaz</div>
						</div>
						${type === 'internal_audit' ? `
						<div style="padding: 10px; background: #f3f4f6; border-radius: 6px;">
							<div style="font-size: 1.5em; font-weight: 700; color: #6b7280;">${pendingCount}</div>
							<div style="font-size: 0.85em; color: #374151;">Cevaplanmadı</div>
						</div>` : ''}
					</div>
				</div> `;

				html += `</div> `;
			} else {
				html += `<div class="section" ><h2 class="section-title red">2. DENETİM SONUÇLARI</h2><p style="color: #6b7280; padding: 20px; text-align: center;">Denetim sonucu bulunamadı.</p></div> `;
			}
		}

		let attachments = [];
		let bucket = '';

		if (type === 'nonconformity') {
			// Hem attachments hem de closing_attachments'ı dahil et
			attachments = [
				...(record.attachments || []),
				...(record.closing_attachments || [])
			];
			bucket = 'df_attachments';
		} else if (type === 'kaizen') {
			attachments = [...(record.attachments_before || []), ...(record.attachments_after || [])];
			bucket = 'kaizen_attachments';
		} else if (type === 'supplier_audit') {
			attachments = record.report_files || [];
			bucket = 'supplier_audit_reports';
		} else if (type === 'deviation') {
			attachments = record.deviation_attachments || [];
			bucket = 'deviation_attachments';
		} else if (type === 'inkr_management') {
			attachments = record.inkr_attachments || [];
			bucket = 'inkr_attachments';
		} else if (type === 'process_inspection') {
			attachments = record.attachments || [];
			bucket = 'process_inspections';
		}

		if (attachments.length > 0) {
			html += `<div class="section" ><h2 class="section-title gray">EKLİ GÖRSELLER</h2><div class="image-grid">`;
			for (const attachment of attachments) {
				let pathToUse = attachment;
				if ((type === 'deviation' || type === 'inkr_management' || type === 'process_inspection') && typeof attachment === 'object' && attachment !== null) {
					pathToUse = attachment.file_path || attachment.path || attachment;
				}
				const url = await getAttachmentUrl(pathToUse, bucket);
				const fileName = (type === 'deviation' || type === 'inkr_management' || type === 'process_inspection') && typeof attachment === 'object' && attachment !== null
					? getAttachmentDisplayName(
							attachment.file_name || attachment.name,
							attachment.file_path || (typeof pathToUse === 'string' ? pathToUse : '')
						)
					: (typeof attachment === 'string' ? attachment : attachment.name || attachment.path || '').split('/').pop();
				const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(typeof pathToUse === 'string' ? pathToUse : (pathToUse.path || pathToUse.file_path || ''));
				if (!url) continue;
				if (isImage) {
					const base64 = await imageUrlToBase64(url);
					html += `<div class="image-container"><a href="${url}" target="_blank" rel="noopener noreferrer"><img src="${base64 || url}" class="attachment-image" alt="Ek" crossOrigin="anonymous"/></a></div>`;
				} else {
					html += `<div class="attachment-file"><a href="${url}" target="_blank" rel="noopener noreferrer">${fileName}</a></div>`;
				}
			}
			html += `</div></div> `;
		}
		return html;
	};

	// Logo base64 - public klasöründeki logo.png dosyasını kullan
	const localLogoUrl = getLogoUrl('logo.png');
	const mainLogoBase64 = logoCache[localLogoUrl] || localLogoUrl;

	return `
		<div class="report-header">
			<div class="report-logo">
				<img src="${mainLogoBase64}" alt="Kademe Logo">
			</div>
			<div class="company-title">
				<h1>KADEME A.Ş.</h1>
				<p>Kalite Yönetim Sistemi</p>
			</div>
			<div class="print-info">
				${(() => {
					const n = getDocumentNumber();
					if (n != null && String(n).trim() !== '' && String(n) !== '-') {
						return `Belge no: ${n}<br>`;
					}
					return '';
				})()}
				Rapor tarihi: ${formatDateTime(new Date())}
			</div>
		</div>

		<div class="meta-box">
			<div class="meta-item"><strong>Belge Türü:</strong> ${getDocumentType()}</div>
			${type === 'inkr_management'
			? `<div class="meta-item"><strong>INKR No:</strong> ${getDocumentNumber()}</div>`
			: `<div class="meta-item"><strong>No:</strong> ${getDocumentNumber()}</div>`
		}
			<div class="meta-item"><strong>Revizyon:</strong> ${record.revision || '0'}</div>
			<div class="meta-item"><strong>Sistem:</strong> Kademe Kalite Yönetim Sistemi</div>
			<div class="meta-item"><strong>Yayın Tarihi:</strong> ${getPublicationDate()}</div>
			<div class="meta-item"><strong>Durum:</strong> ${record.status || '-'}</div>
		</div>

		<div class="section">
			<h2 class="section-title blue">1. TEMEL BİLGİLER</h2>
			<table class="info-table">
				<tbody>
					${(() => {
			const generalInfo = getGeneralInfo();
			return typeof generalInfo === 'object' && generalInfo.tableRows ? generalInfo.tableRows : generalInfo;
		})()}
				</tbody>
			</table>
		</div>
		
		${(() => {
			const generalInfo = getGeneralInfo();
			if (typeof generalInfo === 'object' && generalInfo.problemDescription) {
				// Deviation için "SAPMA AÇIKLAMASI", diğerleri için "PROBLEM TANIMI"
				const sectionTitle = type === 'deviation' ? 'SAPMA AÇIKLAMASI' : 'PROBLEM TANIMI';
				return `
					<div class="section">
						<h2 class="section-title blue">2. ${sectionTitle}</h2>
						<div class="problem-description-block" style="white-space: normal; word-wrap: break-word; padding: 8px; background-color: #ffffff; border-radius: 4px; border: 1px solid #e5e7eb; font-size: 13px; line-height: 1.6;">${generalInfo.problemDescription}</div>
					</div>
				`;
			}
			return '';
		})()
		}
		
		${await getAdditionalSections()}

<div class="section signature-section">
	<h2 class="section-title dark">İMZA VE ONAY</h2>
	<div class="signature-area">
		${type === 'deviation' ? (() => {
			// Approval bilgilerinden isimleri al
			const approvals = record.deviation_approvals || [];
			const getApproverName = (stage) => {
				const approval = approvals.find(a => a.approval_stage === stage);
				return approval && approval.approver_name && approval.approver_name.trim() ? approval.approver_name : null;
			};

			const requestingPerson = record.requesting_person && record.requesting_person.trim() ? record.requesting_person : getApproverName('Üretim Planlama');
			const argePerson = getApproverName('Ar-Ge');
			const qualityPerson = getApproverName('Kalite Kontrol');
			const factoryManager = getApproverName('Fabrika Müdürü');
			const generalManager = 'Kenan Çelik'; // Her zaman Kenan Çelik

			return `
					<div class="signature-box">
						<p class="role">TALEP EDEN</p>
						<div class="signature-line"></div>
						<p class="name">${requestingPerson || '&nbsp;'}</p>
					</div>
					<div class="signature-box">
						<p class="role">ARGE</p>
						<div class="signature-line"></div>
						<p class="name">${argePerson || '&nbsp;'}</p>
					</div>
					<div class="signature-box">
						<p class="role">KALİTE KONTROL<br>VE GÜVENCE</p>
						<div class="signature-line"></div>
						<p class="name">${qualityPerson || '&nbsp;'}</p>
					</div>
					<div class="signature-box">
						<p class="role">FABRİKA MÜDÜRÜ</p>
						<div class="signature-line"></div>
						<p class="name">${factoryManager || '&nbsp;'}</p>
					</div>
					<div class="signature-box">
						<p class="role">GENEL MÜDÜR</p>
						<div class="signature-line"></div>
						<p class="name">${generalManager || '&nbsp;'}</p>
					</div>
				`;
		})() : type === 'equipment_scrap_certificate' ? `
					<div class="signature-box">
						<p class="role">HAZIRLAYAN</p>
						<div class="signature-line"></div>
						<p class="name">&nbsp;</p>
					</div>
					<div class="signature-box">
						<p class="role">KALİTE KONTROL</p>
						<div class="signature-line"></div>
						<p class="name">&nbsp;</p>
					</div>
					<div class="signature-box">
						<p class="role">ONAYLAYAN</p>
						<div class="signature-line"></div>
						<p class="name">&nbsp;</p>
					</div>
				` : `
					<div class="signature-box">
						<p class="role">HAZIRLAYAN</p>
						<div class="signature-line"></div>
						<p class="name">${type === 'incoming_inspection' ? (record.prepared_by ? record.prepared_by : '&nbsp;') : type === 'process_inspection' ? (record.prepared_by || record.operator_name || '&nbsp;') : '&nbsp;'}</p>
					</div>
					<div class="signature-box">
						<p class="role">KONTROL EDEN</p>
						<div class="signature-line"></div>
						<p class="name">${type === 'incoming_inspection' || type === 'process_inspection' ? (record.controlled_by ? record.controlled_by : '&nbsp;') : '&nbsp;'}</p>
					</div>
					<div class="signature-box">
						<p class="role">ONAYLAYAN</p>
						<div class="signature-line"></div>
						<p class="name">${type === 'incoming_inspection' || type === 'process_inspection' ? (record.created_by ? record.created_by : '&nbsp;') : '&nbsp;'}</p>
					</div>
				`}
	</div>
</div>
`;
};

const generateFmeaProjectListHtml = (record) => {
	const escapeHtml = (v) => String(v ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
	const items = record.items || [];
	const localLogoUrl = getLogoUrl('logo.png');
	const mainLogoBase64 = logoCache[localLogoUrl] || localLogoUrl;
	const fmt = (d) => (d ? format(new Date(d), 'dd.MM.yyyy HH:mm', { locale: tr }) : '—');
	const st = (s) => {
		const m = { Draft: 'Taslak', Active: 'Aktif', 'In Review': 'İncelemede', Approved: 'Onaylandı', Obsolete: 'Arşiv' };
		return m[s] || s || '—';
	};
	let rows = '';
	items.forEach((p, i) => {
		rows += `<tr>
			<td style="text-align:center">${i + 1}</td>
			<td><strong>${escapeHtml(p.fmea_number)}</strong></td>
			<td>${escapeHtml(p.fmea_name)}</td>
			<td>${escapeHtml(p.fmea_type)}</td>
			<td>${escapeHtml(p.part_number)}</td>
			<td>${escapeHtml(p.part_name)}</td>
			<td>${st(p.status)}</td>
			<td>${fmt(p.updated_at)}</td>
		</tr>`;
	});
	return `
<div class="report-header">
	<div class="report-logo"><img src="${mainLogoBase64}" alt="Kademe Logo"></div>
	<div class="company-title"><h1>KADEME A.Ş.</h1><p>Kalite Yönetim Sistemi</p></div>
	<div class="print-info">Liste tarihi: ${fmt(new Date().toISOString())}</div>
</div>
<div class="meta-box" style="border-left:4px solid #2980b9;background:#f8fafc;">
	<div class="meta-item"><strong>Belge türü:</strong> FMEA proje listesi</div>
	<div class="meta-item"><strong>Toplam:</strong> ${items.length} proje</div>
</div>
<div class="section">
	<h2 class="section-title dark">Kayıtlar</h2>
	<table class="info-table results-table" style="width:100%;font-size:11px;">
		<thead>
			<tr style="background:#1e3a5f;color:#fff;">
				<th style="padding:10px 8px;">#</th>
				<th style="padding:10px 8px;">FMEA no</th>
				<th style="padding:10px 8px;">Ad</th>
				<th style="padding:10px 8px;">Tip</th>
				<th style="padding:10px 8px;">Parça no</th>
				<th style="padding:10px 8px;">Parça adı</th>
				<th style="padding:10px 8px;">Durum</th>
				<th style="padding:10px 8px;">Güncelleme</th>
			</tr>
		</thead>
		<tbody>${rows || '<tr><td colspan="8" style="text-align:center;padding:24px;color:#64748b">Kayıt yok.</td></tr>'}</tbody>
	</table>
</div>`;
};

const generateFmeaReportHtml = (record) => {
	const escapeHtml = (v) => String(v ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
	const formatCell = (v) => escapeHtml(v).replace(/\n/g, '<br/>');
	const lines = record.fmea_lines || [];
	const ft = record.five_topics || {};
	const localLogoUrl = getLogoUrl('logo.png');
	const mainLogoBase64 = logoCache[localLogoUrl] || localLogoUrl;
	const fmt = (d) => (d ? format(new Date(d), 'dd.MM.yyyy', { locale: tr }) : '—');
	const apT = { HIGH: 'Yüksek', MEDIUM: 'Orta', LOW: 'Düşük' };
	const apColor = { HIGH: '#e74c3c', MEDIUM: '#f39c12', LOW: '#27ae60' };
	let fiveRows = '';
	['intent', 'timing', 'team', 'tasks', 'tools'].forEach((k) => {
		fiveRows += `<tr><td style="font-weight:600;background:#f1f5f9;width:22%;vertical-align:top">${FIVE_T_PDF_LABELS[k]}</td><td style="white-space:pre-wrap;vertical-align:top">${formatCell(formatFiveTopicForPdf(ft, k))}</td></tr>`;
	});
	let lineRows = '';
	lines.forEach((line, idx) => {
		const ap = line.ap_level
			? `<span style="display:inline-block;padding:4px 10px;border-radius:6px;background:${apColor[line.ap_level] || '#64748b'};color:#fff;font-weight:700;font-size:9px;">${apT[line.ap_level] || line.ap_level}</span>`
			: '—';
		const apA = line.ap_after
			? `<span style="display:inline-block;padding:4px 10px;border-radius:6px;background:${apColor[line.ap_after] || '#64748b'};color:#fff;font-weight:700;font-size:9px;">${apT[line.ap_after] || line.ap_after}</span>`
			: '—';
		const inactive = line.is_active === false ? 'opacity:.5;' : '';
		lineRows += `<tr style="vertical-align:top;${inactive}">
			<td style="text-align:center;padding:6px;">${idx + 1}</td>
			<td style="padding:6px;min-width:88px;">${formatCell(line.process_step)}</td>
			<td style="padding:6px;min-width:88px;">${formatCell(line.function_text)}</td>
			<td style="padding:6px;min-width:88px;">${formatCell(line.failure_mode)}</td>
			<td style="padding:6px;min-width:80px;">${formatCell(line.effect)}</td>
			<td style="text-align:center;padding:6px;">${line.severity ?? '—'}</td>
			<td style="padding:6px;min-width:80px;">${formatCell(line.cause)}</td>
			<td style="text-align:center;padding:6px;">${line.occurrence ?? '—'}</td>
			<td style="padding:6px;min-width:76px;">${formatCell(line.current_prevention)}</td>
			<td style="padding:6px;min-width:76px;">${formatCell(line.current_detection)}</td>
			<td style="text-align:center;padding:6px;">${line.detection ?? '—'}</td>
			<td style="text-align:center;padding:6px;font-weight:700;">${line.rpn ?? '—'}</td>
			<td style="text-align:center;padding:6px;">${ap}</td>
			<td style="padding:6px;min-width:100px;">${formatCell(line.recommended_action)}</td>
			<td style="padding:6px;">${formatCell(line.responsible)}</td>
			<td style="padding:6px;white-space:nowrap;">${fmt(line.target_date)}</td>
			<td style="padding:6px;min-width:88px;">${formatCell(line.actions_taken)}</td>
			<td style="text-align:center;padding:6px;">${line.s_after ?? '—'}</td>
			<td style="text-align:center;padding:6px;">${line.o_after ?? '—'}</td>
			<td style="text-align:center;padding:6px;">${line.d_after ?? '—'}</td>
			<td style="text-align:center;padding:6px;">${line.rpn_after ?? '—'}</td>
			<td style="text-align:center;padding:6px;">${apA}</td>
		</tr>`;
	});
	const cust = Array.isArray(record.customer_names) ? record.customer_names.join(', ') : '';
	const team = Array.isArray(record.team_member_names) ? record.team_member_names.join(', ') : '';
	return `
<div class="report-header">
	<div class="report-logo"><img src="${mainLogoBase64}" alt="Kademe Logo"></div>
	<div class="company-title"><h1>KADEME A.Ş.</h1><p>Kalite Yönetim Sistemi</p></div>
	<div class="print-info">${format(new Date(), 'dd.MM.yyyy HH:mm', { locale: tr })}</div>
</div>
<div style="background:linear-gradient(135deg,#1e3a5f 0%,#2980b9 100%);color:#fff;padding:18px 22px;border-radius:10px;margin-bottom:14px;box-shadow:0 4px 14px rgba(30,58,95,.25);">
	<div style="font-size:11px;opacity:.9;letter-spacing:.06em;text-transform:uppercase;">FMEA · Failure Mode and Effects Analysis</div>
	<div style="font-size:20px;font-weight:800;margin-top:6px;line-height:1.25;">${escapeHtml(record.fmea_name)}</div>
	<div style="font-size:13px;opacity:.95;margin-top:4px;">${escapeHtml(record.fmea_number)} · ${escapeHtml(record.fmea_type)}</div>
</div>
<div class="section">
	<h2 class="section-title blue">1. Proje bilgileri</h2>
	<table class="info-table">
		<tbody>
			<tr><td style="width:26%;font-weight:600;background:#f8fafc">FMEA numarası</td><td>${escapeHtml(record.fmea_number)}</td></tr>
			<tr><td style="font-weight:600;background:#f8fafc">Standart</td><td>${escapeHtml(record.standard || 'AIAG_VDA')}</td></tr>
			<tr><td style="font-weight:600;background:#f8fafc">Parça</td><td>${escapeHtml(record.part_number)} ${record.part_name ? `· ${escapeHtml(record.part_name)}` : ''}</td></tr>
			<tr><td style="font-weight:600;background:#f8fafc">Proses adı</td><td>${escapeHtml(record.process_name)}</td></tr>
			<tr><td style="font-weight:600;background:#f8fafc">Revizyon</td><td>${escapeHtml(record.revision_number)} · ${fmt(record.revision_date)}</td></tr>
			<tr><td style="font-weight:600;background:#f8fafc">Firma</td><td>${escapeHtml(record.company_name)}</td></tr>
			<tr><td style="font-weight:600;background:#f8fafc">Müşteriler</td><td>${escapeHtml(cust)}</td></tr>
			<tr><td style="font-weight:600;background:#f8fafc">Ekip üyeleri</td><td>${escapeHtml(team)}</td></tr>
			<tr><td style="font-weight:600;background:#f8fafc">Durum</td><td>${escapeHtml(record.status)}</td></tr>
			<tr><td style="font-weight:600;background:#f8fafc;vertical-align:top">Notlar</td><td style="white-space:pre-wrap">${formatCell(record.notes)}</td></tr>
		</tbody>
	</table>
</div>
<div class="section">
	<h2 class="section-title dark">2. 5T (analiz öncesi)</h2>
	<table class="info-table results-table"><tbody>${fiveRows}</tbody></table>
</div>
<div class="section">
	<h2 class="section-title green">3. Çalışma sayfası</h2>
	<div style="overflow:visible;">
	<table class="info-table results-table fmea-sheet-pdf" style="margin:0;font-size:8px;width:100%;border-collapse:collapse;">
		<thead>
			<tr style="background:#1e3a5f;color:#fff;">
				<th style="padding:8px 5px;">#</th>
				<th style="padding:8px 5px;">Proses</th>
				<th style="padding:8px 5px;">Fonksiyon</th>
				<th style="padding:8px 5px;">Hata</th>
				<th style="padding:8px 5px;">Etki</th>
				<th style="padding:8px 5px;">S</th>
				<th style="padding:8px 5px;">Neden</th>
				<th style="padding:8px 5px;">O</th>
				<th style="padding:8px 5px;">Önl.</th>
				<th style="padding:8px 5px;">Tesp.</th>
				<th style="padding:8px 5px;">D</th>
				<th style="padding:8px 5px;">RPN</th>
				<th style="padding:8px 5px;">Önc.</th>
				<th style="padding:8px 5px;">Tedbir</th>
				<th style="padding:8px 5px;">Sorumlu</th>
				<th style="padding:8px 5px;">Tarih</th>
				<th style="padding:8px 5px;">Alınan</th>
				<th style="padding:8px 5px;">S'</th>
				<th style="padding:8px 5px;">O'</th>
				<th style="padding:8px 5px;">D'</th>
				<th style="padding:8px 5px;">RPN'</th>
				<th style="padding:8px 5px;">Önc.'</th>
			</tr>
		</thead>
		<tbody>${lineRows || '<tr><td colspan="22" style="text-align:center;padding:20px;color:#64748b">Henüz satır yok.</td></tr>'}</tbody>
	</table>
	</div>
</div>
<div class="section signature-section">
	<h2 class="section-title gray">İmza</h2>
	<div class="signature-area" style="display:flex;gap:40px;flex-wrap:wrap;margin-top:8px;">
		<div class="signature-box"><p class="role">HAZIRLAYAN</p><div class="signature-line"></div></div>
		<div class="signature-box"><p class="role">ONAYLAYAN</p><div class="signature-line"></div></div>
	</div>
</div>`;
};

const generatePrintableReportHtml = async (record, type) => {
	// Logoları önceden yükle (cache'de yoksa) - uygunsuzluk yönetimindeki gibi
	await preloadLogos();

	// Record'u normalize et (Türkçe karakterler için)
	const normalizedRecord = normalizeRecord(record);

	let reportContentHtml = '';
	let cssOverrides = ''; // CSS overrides for specific report types

	if (type === 'nonconformity_executive') {
		const contentHtml = generateListReportHtml(record, type);
		// nonconformity_executive için tam HTML formatı (başlık ve imza dahil)
		const formatDateTime = (dateStr) => dateStr ? format(new Date(dateStr), 'dd.MM.yyyy HH:mm') : '-';
		// Logo base64 - public klasöründeki logo.png dosyasını kullan
		const localLogoUrl = getLogoUrl('logo.png');
		const mainLogoBase64 = logoCache[localLogoUrl] || localLogoUrl;
		reportContentHtml = `
		<div class="report-header">
			<div class="report-logo">
				<img src="${mainLogoBase64}" alt="Kademe Logo">
			</div>
			<div class="company-title">
				<h1>KADEME A.Ş.</h1>
				<p>Kalite Yönetim Sistemi</p>
			</div>
			<div class="print-info">
				Rapor Tarihi: ${formatDateTime(new Date())}
			</div>
		</div>

	<div class="meta-box">
		<div class="meta-item"><strong>Belge Türü:</strong> DF/8D Yönetici Özet Raporu</div>
	</div>

			${contentHtml}

<div class="section signature-section">
	<h2 class="section-title dark">İMZA VE ONAY</h2>
	<div class="signature-area">
		<div class="signature-box">
			<p class="role">HAZIRLAYAN</p>
			<div class="signature-line"></div>
			<p class="name">Atakan BATTAL</p>
		</div>
	</div>
</div>
`;
	} else if (type === 'document_list' || type === 'equipment_list' || type === 'deviation_list' || type === 'nonconformity_record_list' || type === 'fixture_list' || type === 'kpi_list' || type === 'leak_test_list' || type === 'process_inspection_list') {
		reportContentHtml = generateListReportHtml(record, type);
		if (type === 'fixture_list') {
			cssOverrides = `
.page-container {
	width: 297mm !important;
	min-height: 210mm !important;
}
.report-wrapper {
	padding: 8mm !important;
}
.report-header {
	margin-bottom: 12px !important;
}
.meta-box.meta-box-header {
	margin-bottom: 10px !important;
}
.list-summary {
	margin-bottom: 12px !important;
}
.results-table th,
.results-table td {
	font-size: 10px !important;
	padding: 8px 9px !important;
	vertical-align: middle !important;
}
.results-table th {
	white-space: nowrap;
}
.fixture-thumb {
	display: block;
	width: 88px;
	height: 64px;
	object-fit: cover;
	border-radius: 8px;
	border: 1px solid #cbd5e1;
	margin: 0 auto;
	background: #ffffff;
}
.fixture-thumb-placeholder {
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 9px;
	font-weight: 600;
	color: #64748b;
	background: #f8fafc;
}
@media print {
	@page {
		size: A4 landscape;
		margin: 8mm;
	}
	body {
		background-color: #fff !important;
	}
	.page-container {
		width: 100% !important;
		margin: 0 !important;
		box-shadow: none !important;
	}
}
`;
		}
	} else if (type === 'nonconformity_record') {
		reportContentHtml = generateManagedNonconformityDetailHtml(normalizedRecord);
	} else if (type === 'supplier_list' || type === 'supplier_dashboard') {
		reportContentHtml = generateListReportHtml(record, type);
	} else if (type === 'quality_cost_executive_summary' || type === 'quality_cost_list' || type === 'quality_cost_detail' || type === 'incoming_quality_executive_summary' || type === 'produced_vehicles_executive_summary' || type === 'supplier_quality_executive_summary') {
		reportContentHtml = generateListReportHtml(record, type);
		// incoming_quality_executive_summary için özel print CSS
		if (type === 'incoming_quality_executive_summary') {
			cssOverrides = `
/* incoming_quality_executive_summary için kompakt layout */
/* Tüm rapor içeriğini tek blok olarak tut - SAYFA KIRILMASI ENGELLE */
.report-wrapper {
	display: block !important;
}
.report-header {
	padding-bottom: 6px !important;
	margin-bottom: 6px !important;
	page-break-after: avoid !important;
}
.report-header h1 {
	font-size: 16px !important;
}
.report-header p {
	font-size: 9px !important;
}
.meta-box {
	padding: 8px 10px !important;
	margin-bottom: 6px !important;
	page-break-after: avoid !important;
}
.meta-item {
	font-size: 8px !important;
}
/* Section header'dan hemen sonra başlamalı */
.section {
	page-break-before: avoid !important;
	margin-top: 0 !important;
}
.section-title {
	font-size: 11px !important;
	padding: 4px 8px !important;
	margin-bottom: 6px !important;
}
/* Özet kartları kompakt */
.list-summary {
	page-break-before: avoid !important;
}
.list-summary > div:first-child {
	margin-bottom: 10px !important;
}
.list-summary > div:first-child > p {
	font-size: 11px !important;
	margin-bottom: 3px !important;
}
/* Kartları kompakt tut */
.list-summary > div > div[style*="display: grid"] {
	gap: 8px !important;
	margin-bottom: 10px !important;
}
.list-summary > div > div[style*="display: grid"] > div {
	padding: 10px !important;
	border-radius: 5px !important;
}
.list-summary > div > div[style*="display: grid"] > div > div:first-child {
	font-size: 8px !important;
	margin-bottom: 4px !important;
}
.list-summary > div > div[style*="display: grid"] > div > div:nth-child(2) {
	font-size: 18px !important;
	margin-bottom: 3px !important;
}
.list-summary > div > div[style*="display: grid"] > div > div:last-child {
	font-size: 8px !important;
	padding-top: 3px !important;
	margin-top: 3px !important;
}
/* Tablolar kompakt */
table {
	font-size: 8px !important;
}
table th, table td {
	padding: 5px 4px !important;
}
h3 {
	font-size: 12px !important;
	margin-bottom: 8px !important;
	padding-bottom: 4px !important;
}
/* Karar bazlı analiz kompakt */
.list-summary > div > div[style*="background-color: #f9fafb"] {
	padding: 10px !important;
	margin-bottom: 10px !important;
}
.list-summary > div > div[style*="background-color: #f9fafb"] h3 {
	font-size: 11px !important;
	margin-bottom: 8px !important;
}
.list-summary > div > div[style*="background-color: #f9fafb"] > div[style*="display: grid"] > div {
	padding: 10px !important;
}
.list-summary > div > div[style*="background-color: #f9fafb"] > div[style*="display: grid"] > div > div:first-child {
	font-size: 10px !important;
}
.list-summary > div > div[style*="background-color: #f9fafb"] > div[style*="display: grid"] > div > div:nth-child(2) {
	font-size: 16px !important;
}

@media print {
	@page {
		size: A4 portrait;
		margin: 8mm;
	}
	* {
		-webkit-print-color-adjust: exact !important;
		print-color-adjust: exact !important;
		color-adjust: exact !important;
	}
	body {
		font-size: 8px !important;
	}
	.page-container {
		margin: 0 !important;
		padding: 0 !important;
		min-height: auto !important;
	}
	.report-wrapper {
		padding: 5mm !important;
	}
	/* ÖNEMLİ: Header, meta-box ve section arasında sayfa kırılması ENGELLE */
	.report-header {
		padding-bottom: 4px !important;
		margin-bottom: 4px !important;
		page-break-inside: avoid !important;
		page-break-after: avoid !important;
	}
	.report-header h1 {
		font-size: 14px !important;
	}
	.report-header p {
		font-size: 8px !important;
	}
	.meta-box {
		padding: 6px 8px !important;
		margin-bottom: 4px !important;
		page-break-inside: avoid !important;
		page-break-after: avoid !important;
	}
	.meta-item {
		font-size: 7px !important;
	}
	/* Section başlığı önceki içerikten ayrılmasın */
	.section {
		page-break-before: avoid !important;
		margin-top: 0 !important;
	}
	.section-title {
		font-size: 10px !important;
		padding: 3px 6px !important;
		margin-bottom: 4px !important;
		page-break-after: avoid !important;
	}
	/* Özet bilgileri ve kartlar */
	.list-summary {
		page-break-before: avoid !important;
	}
	.list-summary > div:first-child {
		margin-bottom: 6px !important;
	}
	.list-summary > div:first-child > p {
		font-size: 9px !important;
		margin-bottom: 2px !important;
	}
	/* Kartları daha kompakt tut */
	.list-summary > div > div[style*="display: grid"] {
		gap: 6px !important;
		margin-bottom: 8px !important;
	}
	.list-summary > div > div[style*="display: grid"] > div {
		padding: 8px !important;
	}
	.list-summary > div > div[style*="display: grid"] > div > div:first-child {
		font-size: 7px !important;
		margin-bottom: 3px !important;
	}
	.list-summary > div > div[style*="display: grid"] > div > div:nth-child(2) {
		font-size: 14px !important;
		margin-bottom: 2px !important;
	}
	.list-summary > div > div[style*="display: grid"] > div > div:last-child {
		font-size: 7px !important;
		padding-top: 2px !important;
		margin-top: 2px !important;
	}
	/* Tablolar kompakt */
	table {
		font-size: 7px !important;
		page-break-inside: auto !important;
	}
	table thead {
		display: table-header-group !important;
	}
	table tbody tr {
		page-break-inside: avoid !important;
	}
	table th, table td {
		padding: 4px 3px !important;
	}
	h3 {
		font-size: 10px !important;
		margin-bottom: 6px !important;
		padding-bottom: 3px !important;
		page-break-after: avoid !important;
	}
	/* Karar bazlı analiz */
	.list-summary > div > div[style*="background-color: #f9fafb"] {
		padding: 6px !important;
		margin-bottom: 8px !important;
	}
	.list-summary > div > div[style*="background-color: #f9fafb"] h3 {
		font-size: 9px !important;
	}
	.list-summary > div > div[style*="background-color: #f9fafb"] > div[style*="display: grid"] > div {
		padding: 8px !important;
	}
	.list-summary > div > div[style*="background-color: #f9fafb"] > div[style*="display: grid"] > div > div:first-child {
		font-size: 8px !important;
	}
	.list-summary > div > div[style*="background-color: #f9fafb"] > div[style*="display: grid"] > div > div:nth-child(2) {
		font-size: 14px !important;
	}
	/* İmza alanı */
	.signature-section {
		page-break-inside: avoid !important;
		margin-top: 10px !important;
	}
	/* Footer */
	.report-footer {
		font-size: 6px !important;
		padding: 4px 8px !important;
	}
}
`;
		}
		// quality_cost_executive_summary için özel print CSS
		if (type === 'quality_cost_executive_summary') {
			cssOverrides = `
/* quality_cost_executive_summary için kompakt layout */
.report-wrapper {
	display: block !important;
}
.report-header {
	padding-bottom: 6px !important;
	margin-bottom: 6px !important;
	page-break-after: avoid !important;
}
.report-header h1 {
	font-size: 16px !important;
}
.report-header p {
	font-size: 12px !important;
}
.meta-box {
	padding: 8px 10px !important;
	margin-bottom: 6px !important;
	page-break-after: avoid !important;
}
.meta-item {
	font-size: 11px !important;
}
.section {
	page-break-before: avoid !important;
	margin-top: 0 !important;
}
.section-title {
	font-size: 11px !important;
	padding: 4px 8px !important;
	margin-bottom: 6px !important;
}
.list-summary {
	page-break-before: avoid !important;
}
.list-summary > div:first-child {
	margin-bottom: 10px !important;
}
.list-summary > div:first-child > p {
	font-size: 11px !important;
	margin-bottom: 3px !important;
}
.list-summary > div > div[style*="display: grid"] {
	gap: 8px !important;
	margin-bottom: 10px !important;
}
.list-summary > div > div[style*="display: grid"] > div {
	padding: 10px !important;
	border-radius: 5px !important;
}
.list-summary > div > div[style*="display: grid"] > div > div:first-child {
	font-size: 10px !important;
	margin-bottom: 4px !important;
}
.list-summary > div > div[style*="display: grid"] > div > div:nth-child(2) {
	font-size: 18px !important;
	margin-bottom: 3px !important;
}
.list-summary > div > div[style*="display: grid"] > div > div:last-child {
	font-size: 10px !important;
	padding-top: 3px !important;
	margin-top: 3px !important;
}
table {
	font-size: 10px !important;
}
table th, table td {
	padding: 5px 4px !important;
}
h3 {
	font-size: 12px !important;
	margin-bottom: 8px !important;
	padding-bottom: 4px !important;
}
.list-summary > div > div[style*="background-color: #f9fafb"] {
	padding: 10px !important;
	margin-bottom: 10px !important;
}
.list-summary > div > div[style*="background-color: #f9fafb"] h3 {
	font-size: 11px !important;
	margin-bottom: 8px !important;
}

@media print {
	@page {
		size: A4 portrait;
		margin: 8mm;
	}
	* {
		-webkit-print-color-adjust: exact !important;
		print-color-adjust: exact !important;
		color-adjust: exact !important;
	}
	body {
		font-size: 10px !important;
	}
	.page-container {
		margin: 0 !important;
		padding: 0 !important;
		min-height: auto !important;
	}
	.report-wrapper {
		padding: 5mm !important;
	}
	.report-header {
		padding-bottom: 4px !important;
		margin-bottom: 4px !important;
		page-break-inside: avoid !important;
		page-break-after: avoid !important;
	}
	.report-header h1 {
		font-size: 14px !important;
	}
	.report-header p {
		font-size: 11px !important;
	}
	.meta-box {
		padding: 6px 8px !important;
		margin-bottom: 4px !important;
		page-break-inside: avoid !important;
		page-break-after: avoid !important;
	}
	.meta-item {
		font-size: 10px !important;
	}
	.section {
		page-break-before: avoid !important;
		margin-top: 0 !important;
	}
	.section-title {
		font-size: 10px !important;
		padding: 3px 6px !important;
		margin-bottom: 4px !important;
		page-break-after: avoid !important;
	}
	.list-summary {
		page-break-before: avoid !important;
	}
	.list-summary > div:first-child {
		margin-bottom: 6px !important;
	}
	.list-summary > div:first-child > p {
		font-size: 11px !important;
		margin-bottom: 2px !important;
	}
	.list-summary > div > div[style*="display: grid"] {
		gap: 6px !important;
		margin-bottom: 8px !important;
	}
	.list-summary > div > div[style*="display: grid"] > div {
		padding: 8px !important;
	}
	.list-summary > div > div[style*="display: grid"] > div > div:first-child {
		font-size: 9px !important;
		margin-bottom: 3px !important;
	}
	.list-summary > div > div[style*="display: grid"] > div > div:nth-child(2) {
		font-size: 16px !important;
		margin-bottom: 2px !important;
	}
	.list-summary > div > div[style*="display: grid"] > div > div:last-child {
		font-size: 9px !important;
		padding-top: 2px !important;
		margin-top: 2px !important;
	}
	table {
		font-size: 9px !important;
		page-break-inside: auto !important;
	}
	table thead {
		display: table-header-group !important;
	}
	table tbody tr {
		page-break-inside: avoid !important;
	}
	table th, table td {
		padding: 4px 3px !important;
	}
	h3 {
		font-size: 10px !important;
		margin-bottom: 6px !important;
		padding-bottom: 3px !important;
		page-break-after: avoid !important;
	}
	.list-summary > div > div[style*="background-color: #f9fafb"] {
		padding: 6px !important;
		margin-bottom: 8px !important;
	}
	.list-summary > div > div[style*="background-color: #f9fafb"] h3 {
		font-size: 9px !important;
	}
	.signature-section {
		page-break-inside: avoid !important;
		margin-top: 10px !important;
	}
	.report-footer {
		font-size: 6px !important;
		padding: 4px 8px !important;
	}
}
`;
		}
	} else if (type.endsWith('_list')) {
		reportContentHtml = generateListReportHtml(record, type);
	} else if (type === 'wps') {
		reportContentHtml = generateWPSReportHtml(record);
	} else if (type === 'certificate') {
		reportContentHtml = generateCertificateReportHtml(record);
	} else if (type === 'training_exam_results') {
		reportContentHtml = generateTrainingExamResultsReportHtml(normalizedRecord);
	} else if (type === 'training_record') {
		reportContentHtml = generateTrainingRecordReportHtml(record);
	} else if (type === 'exam_paper') {
		reportContentHtml = generateExamPaperHtml(record);
	} else if (type === 'dynamic_balance') {
		reportContentHtml = generateDynamicBalanceReportHtml(record);
	} else if (type === 'fmea') {
		reportContentHtml = generateFmeaReportHtml(normalizedRecord);
		cssOverrides = `
@page { size: A3 landscape; margin: 8mm; }
.page-container {
	max-width: 420mm !important;
	width: 100% !important;
}
.report-wrapper { padding: 5mm 7mm !important; }
.fmea-sheet-pdf th, .fmea-sheet-pdf td {
	font-size: 6.5px !important;
	line-height: 1.25 !important;
	padding: 4px 3px !important;
}
.fmea-sheet-pdf th { font-size: 7px !important; }
.section { page-break-inside: auto; }
.results-table thead { display: table-header-group; }
`;
	} else if (type === 'fmea_project_list') {
		reportContentHtml = generateFmeaProjectListHtml(normalizedRecord);
	} else if (type === 'polyvalence_matrix') {
		reportContentHtml = generatePolyvalenceMatrixHtml(record);
		// Override page style for landscape
		cssOverrides = `
/* Landscape format-TAM GENİŞLİK-HEM EKRAN HEM PRINT */
@page {
	size: A4 landscape!important;
	margin: 5mm!important;
}
			
			* {
	box-sizing: border-box!important;
			}
			
			html {
	max-width: 100% !important;
	width: 100% !important;
	margin: 0!important;
	padding: 0!important;
}
			
			body {
	max-width: 100% !important;
	width: 100% !important;
	margin: 0!important;
	padding: 0!important;
	print-color-adjust: exact!important;
	-webkit-print-color-adjust: exact!important;
}
			
			.page-container {
	max-width: 100% !important;
	width: 100% !important;
	margin: 0!important;
	padding: 0!important;
	box-shadow: none!important;
}
			
			.report-wrapper {
	padding: 8px!important;
	max-width: 100% !important;
	width: 100% !important;
	margin: 0!important;
}
			
			.report-header {
	padding: 5px 0!important;
	margin-bottom: 8px!important;
}
			
			.report-header h1 {
	font-size: 16px!important;
	margin: 0!important;
}
			
			.report-header p {
	font-size: 10px!important;
}
			
			.meta-box {
	padding: 6px 10px!important;
	margin-bottom: 8px!important;
}
			
			.meta-box.meta-item {
	font-size: 8px!important;
}
			
			.section {
	margin-bottom: 10px!important;
}
			
			.section-title {
	font-size: 11px!important;
	padding: 5px 10px!important;
	margin-bottom: 8px!important;
}
			
			table {
	font-size: 6.5px!important;
	width: 100% !important;
	table-layout: auto!important;
}
			
			table th,
	table td {
	padding: 3px 4px!important;
	line-height: 1.2!important;
}
			
			table th {
	font-size: 6px!important;
}
			
			.signature-area {
	margin-top: 15px!important;
}
			
			.signature-box {
	padding: 8px!important;
	display: flex!important;
	flex-direction: column!important;
	align-items: center!important;
}
			
			.signature-box.role {
	font-size: 8px!important;
	min-height: 32px!important;
	display: flex!important;
	align-items: flex-start!important;
	justify-content: center!important;
	margin-bottom: 0!important;
	text-align: center;
}
			
			.signature-line {
	margin-top: 8px!important;
	width: 100% !important;
}

/* PRINT-AYNI AYARLAR */
@media print {
	/* Print için renkleri koru */
	* {
		-webkit-print-color-adjust: exact !important;
		print-color-adjust: exact !important;
		color-adjust: exact !important;
	}
	
	@page {
		size: A4 landscape!important;
		margin: 5mm!important;
	}
				
	* {
		box-sizing: border-box!important;
	}
				
	html {
		max-width: 100% !important;
		width: 100% !important;
		margin: 0!important;
		padding: 0!important;
	}
				
	body {
		max-width: 100% !important;
		width: 100% !important;
		margin: 0!important;
		padding: 0!important;
		print-color-adjust: exact!important;
		-webkit-print-color-adjust: exact!important;
	}
	
	/* Sayfa kırılmaları */
	.section { page-break-inside: avoid; break-inside: avoid; }
	.section-title { page-break-after: avoid; break-after: avoid; }
	table { page-break-inside: auto; }
	table thead { display: table-header-group; }
	table tbody tr { page-break-inside: avoid; break-inside: avoid; }
				
				.page-container {
	max-width: 100% !important;
	width: 100% !important;
	margin: 0!important;
	padding: 0!important;
	box-shadow: none!important;
}
				
				.report-wrapper {
	padding: 8px!important;
	max-width: 100% !important;
	width: 100% !important;
	margin: 0!important;
}
				
				.report-header {
	padding: 5px 0!important;
	margin-bottom: 8px!important;
}
				
				.report-header h1 {
	font-size: 16px!important;
	margin: 0!important;
}
				
				.report-header p {
	font-size: 10px!important;
}
				
				.meta-box {
	padding: 6px 10px!important;
	margin-bottom: 8px!important;
}
				
				.meta-box.meta-item {
	font-size: 8px!important;
}
				
				.section {
	margin-bottom: 10px!important;
}
				
				.section-title {
	font-size: 11px!important;
	padding: 5px 10px!important;
	margin-bottom: 8px!important;
}
				
				table {
	font-size: 6.5px!important;
	width: 100% !important;
	table-layout: auto!important;
}
				
				table th,
	table td {
	padding: 3px 4px!important;
	line-height: 1.2!important;
}
				
				table th {
	font-size: 6px!important;
}
				
				.signature-area {
	margin-top: 15px!important;
	page-break-inside: avoid!important;
}
				
				.signature-box {
	padding: 8px!important;
	display: flex!important;
	flex-direction: column!important;
	align-items: center!important;
}
				
				.signature-box.role {
	font-size: 8px!important;
	min-height: 32px!important;
	display: flex!important;
	align-items: flex-start!important;
	justify-content: center!important;
	margin-bottom: 0!important;
	text-align: center;
}
				
				.signature-line {
	margin-top: 8px!important;
	width: 100% !important;
}

				/* Footer print için */
				.report-footer {
	page-break-inside: avoid!important;
}
			}
`;
	} else if (type === 'nonconformity') {
		reportContentHtml = await generateGenericReportHtml(normalizedRecord, type);
		/* Playwright PDF: satır/paragraf ortasında saçma kesilmeleri azalt */
		cssOverrides = `
.problem-description-block {
	overflow: visible;
}
.problem-description-block p {
	orphans: 3;
	widows: 3;
	word-break: normal;
	overflow-wrap: break-word;
	hyphens: none;
}
.step-description-body {
	overflow-wrap: break-word;
	word-break: normal;
	hyphens: none;
}
@media print {
	/* Kutu uzun olduğunda sayfa arası bölünebilir; başlık tek başına sayfa dibinde kalmasın */
	.analysis-box.fillable {
		page-break-inside: auto !important;
		break-inside: auto !important;
	}
	.analysis-box.fillable h4 {
		page-break-after: avoid !important;
		break-after: avoid !important;
	}
	.analysis-box.fillable h4 + .fillable-field {
		page-break-before: avoid !important;
		break-before: avoid !important;
	}
	.fillable-field {
		page-break-inside: avoid !important;
		break-inside: avoid !important;
		margin-bottom: 8px !important;
	}
	.fillable-field strong {
		page-break-after: avoid !important;
		break-after: avoid !important;
	}
	/* Tek sorunun cevap metni çok uzunsa satır içi bölünebilir; kutunun başlığı metinden kopmasın */
	.fillable-line,
	.fillable-area {
		page-break-inside: auto !important;
		break-inside: auto !important;
		orphans: 2;
		widows: 2;
	}
	.problem-description-block p {
		page-break-inside: avoid;
		break-inside: avoid;
	}
}
`;
	} else if (type === 'quarantine_decision_certificate') {
		reportContentHtml = await generateGenericReportHtml(normalizedRecord, type);
		cssOverrides = `
.quarantine-karar-tut-header.report-header {
	display: grid !important;
	grid-template-columns: 76px minmax(0, 1fr) minmax(120px, 30%) !important;
	align-items: center !important;
	gap: 10px 12px !important;
}
.quarantine-karar-tut-header .report-logo {
	flex: none !important;
	width: 76px !important;
}
.quarantine-karar-tut-header .report-logo img {
	max-width: 76px !important;
	height: auto !important;
}
.quarantine-karar-tut-header .company-title {
	min-width: 0 !important;
	text-align: center !important;
	padding: 0 6px !important;
}
.quarantine-karar-tut-header .company-title h1 {
	font-size: 15px !important;
	line-height: 1.2 !important;
	margin: 0 !important;
	white-space: normal !important;
	word-break: normal !important;
}
.quarantine-karar-tut-header .company-title p {
	font-size: 9px !important;
	line-height: 1.3 !important;
	margin: 5px 0 0 0 !important;
	white-space: normal !important;
}
.quarantine-karar-tut-header .print-info {
	white-space: normal !important;
	font-size: 9px !important;
	line-height: 1.4 !important;
	font-weight: 500 !important;
	text-align: right !important;
	word-break: break-word !important;
	overflow-wrap: anywhere !important;
	max-width: 100% !important;
}
`;
	} else {
		reportContentHtml = await generateGenericReportHtml(normalizedRecord, type);
	}

	const formNumber = getFormNumber(normalizedRecord.report_type || type);
	const isCertificate = type === 'certificate';
	const isExam = type === 'exam_paper';
	const isTrainingRecord = type === 'training_record' || type === 'training_exam_results';

	const defaultStyles = `
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700&family=Noto+Sans:wght@400;500;600;700&display=swap');

		/* ============================================
		   SAYFA AYARLARI-PDF OPTİMİZASYONU
		   ============================================ */
		body {
	font-family: 'Noto Sans', 'Roboto', 'Arial Unicode MS', 'Segoe UI', Tahoma, sans-serif;
	color: #1f2937;
	margin: 0;
	padding: 0;
	background-color: #f3f4f6;
	font-size: 11px;
	-webkit-print-color-adjust: exact;
	print-color-adjust: exact;
}
		
	.page-container {
	background-color: white;
	box-sizing: border-box;
	box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
	margin: 20px auto;
	width: 210mm;
	page-break-after: auto;
	min-height: calc(297mm-40px); /* Full page height */
	display: flex;
	flex-direction: column;
}
	
	.report-wrapper {
	padding: 10mm;
	flex: 1; /* Take remaining space */
	display: flex;
	flex-direction: column;
}

		/* ============================================
		   BAŞLIK BÖLÜMÜ - Profesyonel kurumsal header
		   ============================================ */
		.report-header {
	display: grid;
	grid-template-columns: auto 1fr auto;
	gap: 24px;
	align-items: center;
	background: #ffffff;
	border: 1px solid #e5e7eb;
	border-top: 4px solid #1e40af;
	border-radius: 6px;
	padding: 20px 24px;
	margin-bottom: 20px;
	box-shadow: 0 1px 3px rgba(0,0,0,0.06);
	page-break-inside: avoid;
	page-break-after: avoid;
}
		
		.report-logo {
	display: flex;
	align-items: center;
	padding: 4px 0;
}
		.report-logo img {
	height: 52px;
	object-fit: contain;
}
		
		.company-title {
	text-align: center;
	padding: 0 16px;
}
		.company-title h1 {
	font-size: 22px;
	font-weight: 700;
	margin: 0 0 4px 0;
	color: #1e293b;
	letter-spacing: 0.5px;
}
		.company-title p {
	font-size: 13px;
	margin: 0;
	color: #64748b;
	font-weight: 500;
	letter-spacing: 0.3px;
}
		
		.print-info {
	text-align: right;
	font-size: 13px;
	color: #334155;
	font-weight: 600;
	line-height: 1.6;
	white-space: nowrap;
}
		.print-info .report-no {
	font-size: 10px;
	font-weight: 600;
	color: #64748b;
	margin-bottom: 4px;
	text-transform: uppercase;
	letter-spacing: 0.8px;
}
		.print-info .report-id {
	font-size: 12px;
	font-weight: 700;
	color: #1e293b;
	word-break: break-all;
}
		.print-info .report-date {
	font-size: 13px;
	font-weight: 600;
	color: #64748b;
	margin-top: 8px;
	padding-top: 8px;
	border-top: 1px solid #e2e8f0;
}

		/* ============================================
		   META KUTUSU - Başlık ile birlikte kalmalı
		   ============================================ */
		.meta-box {
	display: grid;
	grid-template-columns: 1fr 1fr 1fr;
	gap: 10px 12px;
	background-color: #f8fafc;
	padding: 12px;
	border-radius: 6px;
	margin-bottom: 12px;
	border: 1px solid #e2e8f0;
	border-left: 4px solid #64748b;
	page-break-inside: avoid;
	page-break-after: auto;
	box-sizing: border-box;
	width: 100%;
}
		.meta-box.meta-box-header {
	display: flex;
	flex-wrap: wrap;
	gap: 16px 24px;
	padding: 14px 18px;
	background-color: #f8fafc;
	border-left-color: #1e40af;
}
		.meta-item {
	font-size: 12px;
	color: #374151;
	padding: 0;
	word-wrap: break-word;
	overflow-wrap: break-word;
	line-height: 1.6;
}
		.meta-item strong {
	color: #1f2937;
	font-weight: 600;
	margin-right: 6px;
}

		/* ============================================
		   SEKSİYONLAR – Başlık ile birlikte, uygun yerden bölün
		   ============================================ */
		.section {
	margin-bottom: 12px;
	page-break-inside: auto;
	page-break-after: auto;
	page-break-before: avoid; /* Az yer kaldıysa yeni sayfada başla */
}
		
		.section-title {
	font-size: 13px;
	font-weight: 700;
	padding: 8px 12px;
	border-radius: 4px;
	margin-bottom: 10px;
	text-transform: uppercase;
	letter-spacing: 0.5px;
	page-break-after: avoid;
	page-break-inside: avoid;
	break-after: avoid;
	break-inside: avoid;
}
		/* Profesyonel şerit stili - solid blok yerine sol kenar çizgisi */
		.section-title-strip {
	background-color: #f8fafc !important;
	border-left: 5px solid #2563eb;
	color: #1f2937 !important;
}
		.section-title-strip.blue { border-left-color: #2563eb; }
		.section-title-strip.red { border-left-color: #dc2626; }
		.section-title-strip.green { border-left-color: #16a34a; }
		.section-title-strip.gray { border-left-color: #6b7280; }
		.section-title-strip.dark { border-left-color: #374151; }
		.section-title-strip.amber { border-left-color: #d97706; }
		.section-title-strip[style*="border-left-color:#7c3aed"] { border-left: 5px solid #7c3aed !important; }
		/* Eski solid stili - geriye dönük uyumluluk için */
		.section-title.blue:not(.section-title-strip) { background-color: #2563eb; color: white; }
		.section-title.red:not(.section-title-strip) { background-color: #dc2626; color: white; }
		.section-title.green:not(.section-title-strip) { background-color: #16a34a; color: white; }
		.section-title.gray:not(.section-title-strip) { background-color: #6b7280; color: white; }
		.section-title.dark:not(.section-title-strip) { background-color: #374151; color: white; }
		
		.list-summary {
	margin-bottom: 10px;
	font-size: 12px;
	page-break-inside: auto;
}
		/* Özet kartları tek parça kalsın */
		.list-summary [style*="display: grid"] > div,
		.section [style*="display: grid"] > div {
	page-break-inside: avoid;
	break-inside: avoid;
}

		/* ============================================
		   TABLOLAR-Akıllı sayfa bölünmesi
		   ============================================ */
		.info-table {
	width: 100%;
	border-collapse: collapse;
	page-break-inside: auto;
	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	border-radius: 6px;
	overflow: hidden;
}
		.info-table thead {
	display: table-header-group;
	}
		.info-table td {
	border: 1px solid #e5e7eb;
	padding: 10px 12px;
	font-size: 11px;
	vertical-align: top;
	line-height: 1.5;
}
		.info-table tr {
	page-break-inside: avoid;
	break-inside: avoid;
	page-break-after: auto;
}
		.info-table tr:nth-child(even) td { background-color: #f9fafb; }
		.info-table tr:nth-child(odd) td { background-color: #ffffff; }
		.info-table tr:hover td { background-color: #f0f9ff; }
		.info-table tr td:first-child {
	font-weight: 600;
	width: 25%;
	background-color: #f3f4f6;
	color: #374151;
}
		.info-table pre {
	white-space: pre-wrap;
	font-family: 'Noto Sans', 'Roboto', 'Arial Unicode MS', 'Segoe UI', Tahoma, sans-serif;
	margin: 0;
	font-size: 10px;
}
		
		.item-section-title {
	font-size: 1.1em;
	font-weight: 600;
	margin-top: 10px;
	margin-bottom: 5px;
	padding-bottom: 3px;
	border-bottom: 1px solid #ccc;
	page-break-after: avoid;
}
		
		.item-box {
	border: 1px solid #eee;
	border-radius: 4px;
	padding: 8px;
	margin-bottom: 5px;
	font-size: 9px;
	background: #fdfdfd;
	page-break-inside: avoid;
}
		.item-box p { margin: 2px 0; }
		.item-box:last-child { margin-bottom: 0; }
		
		.pass-table {
	width: 100%;
	border-collapse: collapse;
	font-size: 10px;
	text-align: center;
	page-break-inside: auto;
	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	border-radius: 6px;
	overflow: hidden;
}
		.pass-table th, .pass-table td {
	border: 1px solid #e5e7eb;
	padding: 8px;
}
		.pass-table thead {
	display: table-header-group;
	background-color: #3b82f6;
	color: white;
	font-weight: 600;
	page-break-after: avoid;
}
		.pass-table thead th {
	padding: 10px 8px;
}
		.pass-table tbody tr:nth-child(even) {
	background-color: #f9fafb;
}
		.pass-table tbody tr:nth-child(odd) {
	background-color: #ffffff;
}
		.pass-table tbody tr:hover {
	background-color: #f0f9ff;
}
		.pass-table tbody tr {
	page-break-inside: avoid;
	page-break-after: auto;
}

		/* SONUÇ TABLOLARI – Satırlar arasında bölün, başlık her sayfada */
		.results-table {
	width: 100%;
	border-collapse: collapse;
	page-break-inside: auto;
}
		.results-table th, .results-table td {
	border: 1px solid #e5e7eb;
	padding: 8px 10px;
	font-size: 11px;
	vertical-align: top;
	text-align: left;
}
		.results-table thead {
	display: table-header-group;
	background-color: #f9fafb;
	font-weight: 600;
	page-break-after: avoid;
}
		.results-table tbody tr {
	page-break-inside: avoid;
	break-inside: avoid;
	page-break-after: auto;
}
		.results-table pre {
	white-space: pre-wrap;
	font-family: 'Noto Sans', 'Roboto', 'Arial Unicode MS', 'Segoe UI', Tahoma, sans-serif;
	margin: 0;
	font-size: 10px;
}
		.results-table small.muted {
	color: #6b7280;
	font-size: 9px;
}

		/* ============================================
		   NOTLAR VE AÇIKLAMA KUTULARI
		   ============================================ */
		.notes-box {
	border: 1px solid #e5e7eb;
	padding: 10px;
	border-radius: 4px;
	min-height: 50px;
	font-size: 10px;
	page-break-inside: avoid;
}
		.notes-box pre {
	white-space: pre-wrap;
	font-family: 'Noto Sans', 'Roboto', 'Arial Unicode MS', 'Segoe UI', Tahoma, sans-serif;
	margin: 0;
}

		/* ============================================
		   İMZA ALANI-Sayfanın sonunda bütün kalmalı
		   ============================================ */
		.signature-section {
	page-break-inside: avoid!important;
	page-break-before: auto;
	margin-top: 30px;
	visibility: visible!important;
	display: block!important;
}
		
		.signature-area {
	display: flex!important;
	visibility: visible!important;
	justify-content: space-around;
	align-items: flex-start;
	text-align: center;
	margin-top: 30px;
	padding-top: 15px;
	border-top: 1px solid #e5e7eb;
	page-break-inside: avoid!important;
	page-break-before: auto;
	gap: 10px;
}
		
		.signature-box {
	flex: 1;
	min-width: 0;
	max-width: 20%;
	visibility: visible!important;
	display: flex!important;
	flex-direction: column!important;
	align-items: center!important;
	justify-content: flex-start;
}
		.signature-box .role {
	font-weight: 600;
	font-size: 9px;
	margin-bottom: 0;
	visibility: visible!important;
	text-align: center;
	min-height: 40px;
	max-height: 40px;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0 2px;
	line-height: 1.2;
	word-wrap: break-word;
	overflow-wrap: break-word;
	hyphens: auto;
}
		.signature-line {
	border-bottom: 1px solid #9ca3af;
	margin-top: 8px;
	margin-bottom: 5px;
	width: 100%;
	max-width: 100%;
	height: 20px;
	visibility: visible!important;
	box-sizing: border-box;
}
		.signature-box.name {
	font-size: 11px;
	font-weight: 500;
	margin: 0;
	min-height: 16px;
	visibility: visible!important;
	text-align: center;
}
		.signature-box.title {
	font-size: 9px;
	color: #6b7280;
	margin: 0;
	visibility: visible!important;
}

		/* ============================================
		   FOOTER-Ekranda göster, yazdırmada gizle
		   ============================================ */
		.footer {
	text-align: center;
	font-size: 9px;
	color: #9ca3af;
	padding-top: 10px;
	padding-bottom: 10px;
	border-top: 1px solid #e5e7eb;
	position: relative;
	margin-top: 20px;
}
		.footer-content {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

		/* ============================================
		   ADIM VE ANALİZ KUTULARI
		   ============================================ */
		.step-section {
	margin-top: 10px;
	padding: 10px;
	border-left: 3px solid #2563eb;
	background-color: #fafafa;
	border-radius: 0 4px 4px 0;
	page-break-inside: avoid;
	max-width: 100%;
	box-sizing: border-box;
	overflow: hidden;
}
		.step-title {
	font-weight: bold;
	color: #1e40af;
	page-break-after: avoid;
}
		.step-description { margin-top: 0.4em; }
		.step-description-body {
	font-family: 'Noto Sans', 'Roboto', 'Arial Unicode MS', 'Segoe UI', Tahoma, sans-serif;
	font-size: 10px;
	line-height: 1.55;
	color: #1f2937;
	white-space: normal;
	word-wrap: break-word;
	overflow-wrap: anywhere;
	word-break: break-word;
	max-width: 100%;
	box-sizing: border-box;
	margin: 0.35em 0 0 0;
}
		
		.analysis-box {
	margin-top: 10px;
	padding: 10px;
	border: 1px solid #eee;
	border-radius: 4px;
	page-break-inside: avoid;
}
		.analysis-box h4 {
	font-weight: bold;
	margin-bottom: 10px;
	page-break-after: avoid;
	color: #1f2937;
	font-size: 11px;
}
		.analysis-box p { margin: 2px 0; }

		/* Doldurulabilir alanlar için özel stiller */
		.analysis-box.fillable {
	background-color: #ffffff;
	border: 2px solid #d1d5db;
	padding: 12px;
	margin-bottom: 15px;
}
		.fillable-field {
	margin-bottom: 12px;
	page-break-inside: avoid;
}
		.fillable-field strong {
	display: block;
	font-size: 10px;
	font-weight: 600;
	color: #374151;
	margin-bottom: 4px;
}
		.fillable-line {
	min-height: 20px;
	border-bottom: 1.5px solid #9ca3af;
	padding: 4px 0;
	font-size: 10px;
	color: #1f2937;
	line-height: 1.5;
	word-wrap: break-word;
	width: 100%;
	display: block;
}
		.fillable-area {
	min-height: 50px;
	border: 1.5px solid #9ca3af;
	border-radius: 3px;
	padding: 8px;
	font-size: 10px;
	color: #1f2937;
	line-height: 1.6;
	background-color: #fafafa;
	word-wrap: break-word;
	white-space: pre-wrap;
}

		/* ============================================
		   GÖRSELLER-Sayfa ortasında bölünmesin
		   ============================================ */
		.image-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
	gap: 15px;
	page-break-inside: auto;
	margin-top: 10px;
}
		.image-container {
	page-break-inside: avoid;
	page-break-after: auto;
}
		.attachment-image {
	max-width: 100%;
	height: auto;
	border-radius: 8px;
	border: 2px solid #d1d5db;
	object-fit: cover;
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	transition: transform 0.2s;
}
		.attachment-image:hover {
	box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}
		.attachment-file a {
	text-decoration: none;
	color: #2563eb;
	word-break: break-all;
}

/* ============================================
   LINK URL GİZLEME-Hem ekranda hem print'te
   ============================================ */
a: after,
	a[href]: after,
		a[href]::after {
	content: none!important;
	display: none!important;
}

	/* ============================================
	   FOOTER-Flexbox ile sayfanın altında
	   ============================================ */
	.report-footer {
	margin-top: auto; /* Push to bottom with flexbox */
	padding: 8px 15px;
	border-top: 1px solid #e5e7eb;
	display: flex;
	justify-content: space-between;
	align-items: center;
	flex-wrap: wrap;
	gap: 10px;
	font-size: 7px;
	color: #9ca3af;
	text-transform: none;
	page-break-inside: avoid;
	flex-shrink: 0; /* Don't shrink */
}
	
	.report-footer span {
	white-space: nowrap;
	opacity: 0.8;
}

/* ============================================
   YAZDIR MOD-OPTİMİZE SAYFA DÜZENİ
   ============================================ */
@media print {
	/* Sayfa ayarları – dengeli margin ve akıllı bölünme */
	@page {
		size: A4 portrait;
		margin: 10mm;
		orphans: 3;  /* Sayfa sonunda en az 3 satır */
		widows: 3;   /* Sayfa başında en az 3 satır */
	}

	/* Print için renkleri koru */
	* {
		-webkit-print-color-adjust: exact !important;
		print-color-adjust: exact !important;
		color-adjust: exact !important;
	}

	/* HTML etiketlerini gizle */
	html::before,
	html::after,
	body::before,
	body::after {
		display: none !important;
		content: "" !important;
	}

	/* Tüm URL gösterimlerini kapat */
	a:link:after,
	a:visited:after,
	a[href]:after,
	a[href]::after {
		content: "" !important;
		display: none !important;
	}

	html, body {
		width: 210mm !important;
		height: auto !important;
		background-color: white !important;
		margin: 0 !important;
		padding: 0 !important;
		overflow: visible !important;
	}
			
		.page-container {
		margin: 0!important;
		box-shadow: none!important;
		border: none!important;
		width: 100% !important;
		min-height: 297mm!important; /* Full page height in print */
		padding: 0!important;
		display: flex!important;
		flex-direction: column!important;
	}
		
		.report-wrapper {
		padding: 0!important;
		flex: 1!important; /* Take remaining space */
		margin: 0!important;
		display: flex!important;
		flex-direction: column!important;
	}
		
		.report-footer {
		margin-top: auto!important; /* Push to bottom */
		flex-shrink: 0!important;
	}

			/* Başlık her zaman en başta */
			.report-header {
		page-break-inside: avoid;
		page-break-after: auto; /* Sonra bölünebilir */
	}

			/* Meta kutusu esnekliği */
			.meta-box {
		page-break-inside: avoid;
		page-break-after: auto; /* Sonra bölünebilir */
	}

			/* Bölüm başlıkları içerikten ayrılmasın */
			.section-title {
		page-break-inside: avoid;
		page-break-after: avoid; /* Başlık altındaki içerik ile beraber */
	}

			/* Section'lar esnekliği */
			.section {
		page-break-inside: auto; /* İçerik bölünebilir */
	}

			/* Tablolar akıllıca bölünsün */
			.results-table {
		page-break-inside: auto; /* Tablo bölünebilir */
	}
			
			.results-table thead {
		display: table-header-group; /* Her sayfada header */
	}
			
			.results-table tbody tr {
		page-break-inside: avoid; /* Satır bölünmez */
		page-break-after: auto; /* Sonra bölünebilir */
	}

			/* Pass/Info tablolar */
			.pass-table,
			.info-table {
		page-break-inside: auto;
	}
			
			.pass-table tr,
			.info-table tr {
		page-break-inside: avoid;
		page-break-after: auto;
	}

			/* Notes ve Analysis kutular */
			.notes-box,
			.analysis-box {
		page-break-inside: auto; /* Uzunsa bölünebilir */
	}

			/* İmza alanı-sayfanın sonunda bütün kal */
			.signature-section {
		page-break-inside: avoid!important;
		page-break-before: auto; /* Gerekirse yeni sayfada başla */
		margin-top: 20px;
	}
			
			.signature-area {
		page-break-inside: avoid!important;
	}

			/* Footer gizle */
			.footer {
		display: none!important;
	}

			/* Görseller yarım kesilmesin */
			.image-container {
		page-break-inside: avoid;
	}

			/* Kutu elementleri bölünmesin */
			.item-box,
			.notes-box,
			.analysis-box,
			.step-section {
		page-break-inside: avoid;
	}

			/* Fillable alanlar için özel ayarlar */
			.fillable-field {
		page-break-inside: avoid;
		break-inside: avoid;
	}

			.fillable-line,
			.fillable-area {
		page-break-inside: avoid;
		break-inside: avoid;
	}

			/* Section başlıkları ve içerikleri birlikte kalsın */
			.section-title {
		page-break-after: avoid;
		break-after: avoid;
	}

			/* Section içeriği başlıktan ayrılmasın */
			.section > *:first-child {
		page-break-after: avoid;
		break-after: avoid;
	}
}
`;

	const certificateStyles = `
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;700&family=Playfair+Display:wght@700&family=Dancing+Script:wght@700&display=swap');
		body {
	background-color: #f0f2f5;
	font-family: 'Montserrat', sans-serif;
	display: flex;
	align-items: center;
	justify-content: center;
	min-height: 100vh;
	margin: 0;
	-webkit-print-color-adjust: exact;
	print-color-adjust: exact;
}
		.page-container {
	width: 297mm;
	height: 210mm;
	background-color: #ffffff;
	box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
	margin: 0;
	overflow: hidden;
}
		.report-wrapper {
	padding: 0;
	height: 100%;
}
		.certificate-container {
	width: 100%;
	height: 100%;
	box-sizing: border-box;
	position: relative;
	overflow: hidden;
}
		.certificate-content {
	width: 100%;
	height: 100%;
	text-align: center;
	display: flex;
	flex-direction: column;
	justify-content: space-between;
	align-items: center;
	padding: 10mm;
	box-sizing: border-box;
	position: relative;
	z-index: 2;
	border: 10px solid #f0f0f0;
}
		.bg-shape {
	position: absolute;
	background: linear-gradient(45deg, #0033a0, #0056b3);
	border-radius: 50%;
	opacity: 0.1;
	z-index: 1;
}
		.bg-shape.top-right {
	width: 300px;
	height: 300px;
	top: -100px;
	right: -100px;
}
		.bg-shape.bottom-left {
	width: 400px;
	height: 400px;
	bottom: -150px;
	left: -150px;
}
		.certificate-content::before {
	content: '';
	position: absolute;
	top: 20px;
	left: 20px;
	right: 20px;
	bottom: 20px;
	border: 2px solid #d4af37;
	z-index: -1;
}
		.logo-header {
	width: 100%;
	display: flex;
	justify-content: space-between;
	align-items: center;
	cursor: default ;
}
		.header-logo {
	height: 50px;
	object-fit: contain;
	cursor: default ;
}
		.header-section { margin-bottom: 10px; }
		.company-name { font-size: 14pt; color: #555; letter-spacing: 1px; font-weight: 500; }
		.main-title {
	font-family: 'Playfair Display', serif;
	font-size: 36pt;
	font-weight: 700;
	color: #0033a0;
	margin: 5px 0;
}
		.subtitle { font-size: 11pt; color: #666; margin: 0; }
		
		.participant-name {
	font-family: 'Dancing Script', cursive;
	font-size: 48pt;
	color: #0033a0;
	margin: 10px 0;
}
		
		.training-title {
	font-size: 12pt;
	color: #555;
	margin: 0 auto 20px auto;
	max-width: 80%;
}

		.details-section {
	width: 100%;
	display: flex;
	justify-content: space-around;
	align-items: center;
	margin: 15px 0;
}
		.detail-item { text-align: center; display: flex; flex-direction: column; }
		.detail-item strong { font-size: 10pt; color: #555; margin-bottom: 4px; }
		.detail-item span { font-size: 11pt; font-weight: 500; }

		.signature-area {
	width: 100%;
	display: flex;
	justify-content: space-between;
	align-items: flex-end;
	padding-top: 20px;
}
		.signature-block { text-align: center; width: 30%; }
		.signature-line {
	border-bottom: 1px solid #333;
	margin-bottom: 8px;
	height: 30px;
	width: 100%;
}
		.name { font-size: 11pt; font-weight: 700; margin: 0; }
		.title { font-size: 9pt; color: #666; margin: 0; }
		
		.footer { display: none; }

/* Link URL gizle */
a: after,
	a[href]: after,
		a[href]::after {
	content: none!important;
	display: none!important;
}

@media print {
	@page { size: A4 landscape; margin: 0; }
			body { background-color: #fff; }
			.page-container { box-shadow: none; border: none; margin: 0; height: 100vh; }
}
`;

	const examPaperStyles = `
		body {
	font-size: 11px;
	color: #333;
	-webkit-print-color-adjust: exact;
	print-color-adjust: exact;
}
		.report-wrapper { padding: 10mm; }
		
		.exam-header {
	display: grid;
	grid-template-columns: auto 1fr auto;
	gap: 20px;
	align-items: center;
	border-bottom: 2px solid #0033a0;
	padding-bottom: 10px;
	margin-bottom: 15px;
}
		.company-logo-exam img { height: 60px; }
		.exam-title-section { text-align: center; }
		.exam-title-section h1 { font-size: 18px; font-weight: 700; color: #0033a0; margin: 0; }
		.exam-title-section p { font-size: 12px; color: #555; margin: 0; }
		.exam-meta-grid { font-size: 9px; text-align: right; color: #666; }

		.exam-participant-info {
	display: grid;
	grid-template-columns: repeat(4, 1fr);
	gap: 15px;
	background-color: #f9fafb;
	padding: 15px;
	border-radius: 8px;
	margin-bottom: 20px;
	border: 1px solid #e5e7eb;
}
		.exam-info-field { display: flex; flex-direction: column; }
		.exam-info-field label { font-size: 10px; font-weight: 600; color: #555; margin-bottom: 4px; }
		.exam-info-field span {
	height: 24px;
	border-bottom: 1px dotted #999;
	font-size: 12px;
	font-weight: 500;
}
		.exam-info-field span.static-value { border-bottom: none; }

		.exam-questions-container { display: flex; flex-direction: column; gap: 15px; }
		.exam-question-card {
	border: 1px solid #e5e7eb;
	border-radius: 8px;
	padding: 15px;
	page-break-inside: avoid;
	background: #fff;
}
		.exam-question-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
		.exam-question-number { font-size: 13px; font-weight: 700; color: #0033a0; }
		.exam-question-points { font-size: 11px; font-weight: 500; background: #e0e7ff; color: #3730a3; padding: 3px 8px; border-radius: 12px; }
		.exam-question-text { font-size: 12px; line-height: 1.6; margin-bottom: 15px; }
		
		.exam-options-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 10px;
}
		.exam-option { display: flex; align-items: center; background: #f9fafb; padding: 8px; border-radius: 6px; border: 1px solid #f3f4f6; }
		.exam-option-letter {
	flex-shrink: 0;
	width: 24px;
	height: 24px;
	border-radius: 50%;
	background: #fff;
	border: 1px solid #d1d5db;
	display: flex;
	align-items: center;
	justify-content: center;
	font-weight: 600;
	margin-right: 10px;
}
		.exam-option-text { font-size: 11px; }

		.footer { display: block!important; }

/* Link URL gizle */
a: after,
	a[href]: after,
		a[href]::after {
	content: none!important;
	display: none!important;
}
`;

	return `<!DOCTYPE html>
<html lang="tr">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="X-UA-Compatible" content="IE=edge">
	<title>${escapeHtmlTitle(getReportTitle(normalizedRecord, type))}</title>
	<style>
		${isCertificate ? certificateStyles : (isExam ? `${defaultStyles} ${examPaperStyles}` : isTrainingRecord ? `${defaultStyles} ${trainingRecordReportStyles}` : defaultStyles)}
		${cssOverrides}
	</style>
</head>
<body>
	<div class="page-container">
		<div class="report-wrapper">
			${reportContentHtml}
		</div>
		${!isCertificate ? `
		<div class="report-footer">
			<span>Bu belge, Kalite Yönetim Sistemi tarafından otomatik olarak oluşturulmuştur.</span>
			${!isTrainingRecord ? `<span>Belge Tarihi: ${format(new Date(), 'dd.MM.yyyy HH:mm')}</span>` : ''}
			<span>Form No: ${formNumber}</span>
			<span>Sayfa 1/1</span>
			<span>Rev: 01</span>
		</div>
		` : ''}
	</div>
</body>
</html>`
};

export { openPrintableReport, getReportTitle, generatePrintableReportHtml };
