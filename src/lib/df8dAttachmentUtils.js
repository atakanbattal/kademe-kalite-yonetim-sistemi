/**
 * non_conformities.attachments / closing_attachments için depolama yolu yardımcıları.
 * (Eski sürümde yol–kayıt id eşleştirmesi çok agresifti: klasördeki uuid satır id'siyle
 * farklı olduğunda tüm ekler gizleniyordu; bu dosyada yalnızca normalizasyon tutulur.)
 */

/**
 * Açılış/kapanış ek depo yolu → Supabase Storage bucket adı.
 * Eski kayıtlar `documents` bucket'ında `nc_attachments/` veya `closing_attachments/` altında.
 */
export function getBucketForNcAttachmentPath(storagePath) {
  const p = String(storagePath || '').trim();
  if (!p) return 'df_attachments';
  if (p.startsWith('nc_attachments/')) return 'documents';
  if (p.startsWith('closing_attachments/')) return 'documents';
  return 'df_attachments';
}

/** Aynı nesne yanlış bucket’ta kalmış eski kayıtlar için indirme sırası */
export function bucketsToTryForNcAttachmentPath(storagePath) {
  const primary = getBucketForNcAttachmentPath(storagePath);
  const secondary = primary === 'documents' ? 'df_attachments' : 'documents';
  return [primary, secondary];
}

function getSupabaseUrlAndAnonKey() {
  const baseUrl =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL
      ? String(import.meta.env.VITE_SUPABASE_URL).replace(/\/$/, '')
      : '';
  const anonKey =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY
      ? String(import.meta.env.VITE_SUPABASE_ANON_KEY)
      : '';
  return { baseUrl, anonKey };
}

/** Storage REST — çoğu projede yalnızca Authorization yetmez; gateway apikey ister */
function storageFetchHeaders(accessToken) {
  const { anonKey } = getSupabaseUrlAndAnonKey();
  const headers = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (anonKey) headers.apikey = anonKey;
  return headers;
}

/** JSONB içinde saklanmış { path } veya düz string yolu üretir */
export function normalizeNcAttachmentPath(entry) {
  if (entry == null) return null;
  if (typeof entry === 'object' && typeof entry.path === 'string') {
    return normalizeNcAttachmentPath(entry.path);
  }
  if (typeof entry === 'object' && typeof entry.url === 'string') {
    return normalizeNcAttachmentPath(entry.url);
  }
  if (typeof entry === 'string') {
    const s = stripSupabaseStoragePathFromUrl(entry.trim());
    return s.length > 0 ? s : null;
  }
  return null;
}

/** Tam Storage URL string'i ise bucket hariç nesne yoluna indirger (eski kayıtlar / dışa aktarım) */
function stripSupabaseStoragePathFromUrl(maybeUrl) {
  const t = String(maybeUrl || '').trim();
  if (!t || !/^https?:\/\//i.test(t)) return t;
  try {
    const u = new URL(t);
    const parts = u.pathname.split('/').filter(Boolean);
    const objIdx = parts.indexOf('object');
    if (
      objIdx >= 0 &&
      parts[objIdx + 1] === 'v1' &&
      parts[objIdx + 2] === 'object' &&
      parts[objIdx + 3] &&
      parts[objIdx + 4]
    ) {
      const kind = parts[objIdx + 3];
      if (kind === 'public' || kind === 'authenticated' || kind === 'sign') {
        const rest = parts.slice(objIdx + 5);
        if (rest.length) return rest.map((seg) => decodeURIComponent(seg)).join('/');
      }
    }
  } catch {
    /* orijinal */
  }
  return t;
}

/**
 * DF/8D ekleri: storage.download başarısız olsa bile (SDK/ortam) oturumlu REST ve imzalı URL ile blob alır.
 * img önizlemesi her zaman blob: ile beslenir — tarayıcıda imzalı GET 404 JSON döndüğünde oluşan kırılmayı önler.
 */
export async function fetchNcAttachmentAsBlob(supabaseClient, rawPath) {
  const pathNorm = normalizeNcAttachmentPath(rawPath) || String(rawPath || '').trim();
  if (!pathNorm) {
    return { blob: null, error: new Error('Boş depo yolu') };
  }

  const {
    data: { session } = { session: null },
  } = await supabaseClient.auth.getSession();
  let activeSession = session;
  if (!activeSession) {
    await supabaseClient.auth.refreshSession();
    const again = await supabaseClient.auth.getSession();
    activeSession = again?.data?.session ?? null;
  }
  const token = activeSession?.access_token || null;

  const tryDownload = async () => {
    for (const b of bucketsToTryForNcAttachmentPath(pathNorm)) {
      const { data, error } = await supabaseClient.storage.from(b).download(pathNorm);
      if (!error && data && data.size > 0) return { blob: data, error: null };
    }
    return { blob: null, error: new Error('Storage download başarısız') };
  };

  const tryAuthenticatedFetch = async () => {
    const { baseUrl } = getSupabaseUrlAndAnonKey();
    if (!token || !baseUrl) return { blob: null, error: new Error('oturum veya URL yok') };
    const objectPath = pathNorm.split('/').map(encodeURIComponent).join('/');
    const hdrs = storageFetchHeaders(token);

    for (const b of bucketsToTryForNcAttachmentPath(pathNorm)) {
      const url = `${baseUrl}/storage/v1/object/${encodeURIComponent(b)}/${objectPath}`;
      const res = await fetch(url, { headers: hdrs });
      if (!res.ok) continue;
      const blob = await res.blob();
      if (!blob || blob.size === 0) continue;
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) continue;
      return { blob, error: null };
    }
    return { blob: null, error: new Error('authenticated GET başarısız') };
  };

  const trySignedFetch = async () => {
    const { anonKey } = getSupabaseUrlAndAnonKey();
    const signHeaders = anonKey ? { apikey: anonKey } : {};

    for (const b of bucketsToTryForNcAttachmentPath(pathNorm)) {
      const { data: sign, error: sErr } = await supabaseClient.storage.from(b).createSignedUrl(pathNorm, 3600);
      if (sErr || !sign?.signedUrl) continue;
      const res = await fetch(sign.signedUrl, { headers: signHeaders });
      if (!res.ok) continue;
      const blob = await res.blob();
      if (!blob || blob.size === 0) continue;
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) continue;
      return { blob, error: null };
    }
    return { blob: null, error: new Error('imzalı URL ile indirme başarısız') };
  };

  let { blob, error } = await tryDownload();
  if (blob) return { blob, error: null };

  ({ blob, error } = await tryAuthenticatedFetch());
  if (blob) return { blob, error: null };

  ({ blob, error } = await trySignedFetch());
  if (blob) return { blob, error: null };

  return { blob: null, error: error || new Error('tüm kanallar başarısız') };
}

/**
 * Blob başından görüntü formatı tahmini (uzantı yok veya application/octet-stream için).
 */
export async function sniffImageMimeFromBlob(blob) {
  if (!blob || blob.size < 12) return null;
  try {
    const buf = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
    if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
    if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
    if (buf.length >= 4 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
    if (buf.length >= 4 && buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2a && buf[3] === 0x00) return 'image/tiff';
    if (buf.length >= 4 && buf[0] === 0x4d && buf[1] === 0x4d && buf[2] === 0x00 && buf[3] === 0x2a) return 'image/tiff';
    if (buf.length >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) {
      const t = String.fromCharCode(buf[8] || 0, buf[9] || 0, buf[10] || 0, buf[11] || 0);
      if (t === 'WEBP') return 'image/webp';
    }
    if (buf.length >= 12 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
      const brand = String.fromCharCode(buf[8], buf[9], buf[10], buf[11]).toLowerCase();
      if (brand === 'heic' || brand === 'heix' || brand === 'hevc' || brand === 'hevx') return 'image/heic';
      if (brand === 'mif1' || brand === 'msf1') return 'image/heif';
      if (brand === 'avif' || brand === 'avis') return 'image/avif';
    }
  } catch {
    /* ignore */
  }
  return null;
}

const HEIC_FAMILY_MIME = new Set(['image/heic', 'image/heif']);

function mimeNeedsDownloadInsteadOfImg(mime, storagePath) {
  if (HEIC_FAMILY_MIME.has(mime)) return true;
  if (mime === 'image/tiff') return true;
  if (/\.(heic|heif|tif|tiff)$/i.test(String(storagePath || ''))) return true;
  return false;
}

/**
 * Önizleme blob'unu hazırlar: sniff, pdf tipi, tarayıcıda <img> ile gösterilemeyecek HEIC/HEIF ayrımı.
 */
export async function prepareNcAttachmentPreviewBlob(blob, storagePath) {
  const baseName = String(storagePath || '').split('/').pop() || '';
  const isImgPath = /\.(jpg|jpeg|png|gif|webp|bmp|svg|tiff|tif|heic|heif|avif)$/i.test(storagePath);
  const imgByMime = String(blob.type || '').startsWith('image/');
  const isPdfPath = /\.pdf$/i.test(storagePath);
  const sniffed = await sniffImageMimeFromBlob(blob);

  let outBlob = blob;
  if (isPdfPath && !String(blob.type || '').includes('pdf')) {
    outBlob = new Blob([blob], { type: 'application/pdf' });
  } else if (sniffed) {
    outBlob = new Blob([blob], { type: sniffed });
  } else if ((isImgPath || imgByMime) && !isPdfPath) {
    outBlob = ensureImageBlobMime(blob, baseName);
  }

  const effectiveType = String(outBlob.type || sniffed || '');
  const noInlineImgPreview = mimeNeedsDownloadInsteadOfImg(effectiveType, storagePath);

  const isProbablyImage =
    isImgPath || imgByMime || (!!sniffed && sniffed.startsWith('image/'));

  const blobLooksImage = isProbablyImage && !noInlineImgPreview;

  return {
    outBlob,
    blobLooksImage,
    noInlineImgPreview,
    fileName: baseName,
  };
}

/** İmaj blob'ları için Content-Type bazen octet-stream gelir — img decode için güvenli tür ata */
export function ensureImageBlobMime(blob, fileNameHint) {
  if (!blob || blob.type?.startsWith('image/')) return blob;
  const ext = String(fileNameHint || '').split('.').pop()?.toLowerCase();
  const map = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
    tif: 'image/tiff',
    tiff: 'image/tiff',
    heic: 'image/heic',
    heif: 'image/heif',
  };
  const mime = map[ext];
  if (!mime) return blob;
  return new Blob([blob], { type: mime });
}

/** Görünüm / form için string yol listesine çevirir */
export function normalizeNcAttachmentPathsList(rawList) {
  if (!Array.isArray(rawList)) return [];
  const out = [];
  const seen = new Set();
  for (const item of rawList) {
    const p = normalizeNcAttachmentPath(item);
    if (p && !seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  }
  return out;
}
