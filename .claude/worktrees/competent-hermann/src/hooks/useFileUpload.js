/**
 * useFileUpload - Merkezi dosya yükleme hook'u
 * Tüm modüllerde tekrar eden file upload mantığını birleştirir.
 * Mevcut kodları BOZMAZ - yeni modüllerde ve refactor'larda kullanılabilir.
 */
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { supabase } from '@/lib/customSupabaseClient';
import { sanitizeFileName } from '@/lib/utils';

/**
 * @param {Object} options
 * @param {string} options.bucket - Supabase storage bucket adı (örn: 'df_attachments', 'ppap_documents')
 * @param {string} options.folder - Dosya yolu prefix'i (örn: record ID)
 * @param {number} options.maxFiles - Maksimum dosya sayısı (default: 10)
 * @param {number} options.maxSize - Maksimum dosya boyutu bytes (default: 50MB)
 * @param {string[]} options.acceptedTypes - Kabul edilen MIME tipleri
 * @param {Function} options.onUploadComplete - Upload tamamlandığında çağrılır
 * @param {Function} options.onError - Hata durumunda çağrılır
 */
export function useFileUpload({
    bucket = 'df_attachments',
    folder = '',
    maxFiles = 10,
    maxSize = 50 * 1024 * 1024, // 50MB
    acceptedTypes = undefined,
    onUploadComplete = null,
    onError = null,
} = {}) {
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadedPaths, setUploadedPaths] = useState([]);
    const [errors, setErrors] = useState([]);

    // Dosya adını güvenli hale getir
    const createSafeFilePath = useCallback((originalFileName, subFolder) => {
        const safeName = sanitizeFileName(originalFileName) || 'file';
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 9);
        const safeFileName = `${timestamp}-${randomStr}-${safeName}`;
        const prefix = subFolder || folder;
        return prefix ? `${prefix}/${safeFileName}` : safeFileName;
    }, [folder]);

    // Dosya ekleme (drag & drop veya seçim)
    const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
        // Reddedilen dosyaları kontrol et
        if (rejectedFiles && rejectedFiles.length > 0) {
            const rejectErrors = rejectedFiles.map(f => {
                const reasons = f.errors.map(e => e.message).join(', ');
                return `${f.file.name}: ${reasons}`;
            });
            setErrors(prev => [...prev, ...rejectErrors]);
            if (onError) onError(rejectErrors);
        }

        // Kabul edilen dosyaları ekle (limit kontrolü ile)
        setFiles(prev => {
            const total = prev.length + acceptedFiles.length;
            if (total > maxFiles) {
                const allowed = acceptedFiles.slice(0, maxFiles - prev.length);
                setErrors(prev => [...prev, `Maksimum ${maxFiles} dosya yüklenebilir.`]);
                return [...prev, ...allowed];
            }
            return [...prev, ...acceptedFiles];
        });
    }, [maxFiles, onError]);

    // Dropzone config
    const dropzoneConfig = {
        onDrop,
        maxSize,
        multiple: maxFiles > 1,
    };
    if (acceptedTypes) {
        dropzoneConfig.accept = acceptedTypes.reduce((acc, type) => {
            acc[type] = [];
            return acc;
        }, {});
    }

    const { getRootProps, getInputProps, isDragActive } = useDropzone(dropzoneConfig);

    // Dosya kaldır
    const removeFile = useCallback((fileToRemove) => {
        setFiles(prev => prev.filter(f => f !== fileToRemove));
    }, []);

    // Tüm dosyaları temizle
    const clearFiles = useCallback(() => {
        setFiles([]);
        setUploadedPaths([]);
        setErrors([]);
        setUploadProgress(0);
    }, []);

    // Dosyaları Supabase'e yükle
    const uploadFiles = useCallback(async (subFolder) => {
        if (files.length === 0) return { paths: [], errors: [] };

        setUploading(true);
        setUploadProgress(0);
        const uploadedResults = [];
        const uploadErrors = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const filePath = createSafeFilePath(file.name, subFolder);

            try {
                // Safari uyumluluğu için dosyayı ArrayBuffer olarak oku
                const arrayBuffer = await file.arrayBuffer();
                const blob = new Blob([arrayBuffer], { type: file.type || 'application/octet-stream' });

                const { data, error } = await supabase.storage
                    .from(bucket)
                    .upload(filePath, blob, {
                        contentType: file.type || 'application/octet-stream',
                        cacheControl: '3600',
                        upsert: false,
                    });

                if (error) {
                    uploadErrors.push({ file: file.name, error: error.message });
                } else if (data?.path) {
                    uploadedResults.push(data.path);
                }
            } catch (err) {
                uploadErrors.push({ file: file.name, error: err.message });
            }

            setUploadProgress(Math.round(((i + 1) / files.length) * 100));
        }

        setUploadedPaths(uploadedResults);
        setUploading(false);

        if (uploadErrors.length > 0) {
            setErrors(prev => [...prev, ...uploadErrors.map(e => `${e.file}: ${e.error}`)]);
            if (onError) onError(uploadErrors);
        }

        if (onUploadComplete) onUploadComplete(uploadedResults);

        return { paths: uploadedResults, errors: uploadErrors };
    }, [files, bucket, createSafeFilePath, onUploadComplete, onError]);

    // Dosya signed URL al
    const getSignedUrl = useCallback(async (path, expiresIn = 3600) => {
        try {
            const { data, error } = await supabase.storage
                .from(bucket)
                .createSignedUrl(path, expiresIn);
            if (error) return null;
            return data?.signedUrl || null;
        } catch {
            return null;
        }
    }, [bucket]);

    // Dosya sil
    const deleteFile = useCallback(async (path) => {
        try {
            const { error } = await supabase.storage
                .from(bucket)
                .remove([path]);
            return !error;
        } catch {
            return false;
        }
    }, [bucket]);

    return {
        // State
        files,
        uploading,
        uploadProgress,
        uploadedPaths,
        errors,
        isDragActive,
        // Actions
        getRootProps,
        getInputProps,
        removeFile,
        clearFiles,
        uploadFiles,
        getSignedUrl,
        deleteFile,
        setFiles,
    };
}
