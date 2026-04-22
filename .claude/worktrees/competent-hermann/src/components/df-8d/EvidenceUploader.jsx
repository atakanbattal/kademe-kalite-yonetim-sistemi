import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { UploadCloud, X, File, Image, Video, FileText, Trash2, Eye } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const EvidenceUploader = ({ stepKey, ncId, evidenceFiles = [], onEvidenceChange }) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [previewType, setPreviewType] = useState(null);

    // Dosya adını normalize et ve güvenli hale getir
    const normalizeFileName = (fileName) => {
        if (!fileName) return 'file';

        // Türkçe karakterleri ASCII'ye çevir
        const turkishToAscii = {
            'ç': 'c', 'Ç': 'C',
            'ğ': 'g', 'Ğ': 'G',
            'ı': 'i', 'İ': 'I',
            'ö': 'o', 'Ö': 'O',
            'ş': 's', 'Ş': 'S',
            'ü': 'u', 'Ü': 'U'
        };

        let normalized = fileName;
        Object.keys(turkishToAscii).forEach(key => {
            normalized = normalized.replace(new RegExp(key, 'g'), turkishToAscii[key]);
        });

        // Dosya adını ve uzantısını ayır
        const lastDotIndex = normalized.lastIndexOf('.');
        let name = normalized;
        let ext = '';

        if (lastDotIndex > 0 && lastDotIndex < normalized.length - 1) {
            name = normalized.substring(0, lastDotIndex);
            ext = normalized.substring(lastDotIndex + 1);
        }

        // Özel karakterleri temizle ve boşlukları tire ile değiştir
        name = name
            .replace(/[^a-zA-Z0-9\-_]/g, '-') // Sadece harf, rakam, tire ve alt çizgi bırak
            .replace(/-+/g, '-') // Birden fazla tireyi tek tireye çevir
            .replace(/^-|-$/g, ''); // Başta ve sonda tire varsa kaldır

        // Uzantıyı temizle
        ext = ext.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

        // Eğer uzantı yoksa veya geçersizse, orijinal dosyadan al
        if (!ext || ext.length === 0) {
            const originalLastDot = fileName.lastIndexOf('.');
            if (originalLastDot > 0 && originalLastDot < fileName.length - 1) {
                ext = fileName.substring(originalLastDot + 1).toLowerCase();
            }
        }

        // Eğer hala uzantı yoksa varsayılan ekle
        if (!ext || ext.length === 0) {
            ext = 'file';
        }

        // Eğer isim boşsa varsayılan isim kullan
        if (!name || name.length === 0) {
            name = 'file';
        }

        return `${name}.${ext}`;
    };

    // Güvenli dosya yolu oluştur
    const createSafeFilePath = (originalFileName, ncId, stepKey) => {
        const normalizedName = normalizeFileName(originalFileName);
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 9);
        const safeFileName = `${timestamp}-${randomStr}-${normalizedName}`;

        // ncId ve stepKey'i de güvenli hale getir
        const safeNcId = String(ncId || 'unknown').replace(/[^a-zA-Z0-9\-_]/g, '-');
        const safeStepKey = String(stepKey || 'step').replace(/[^a-zA-Z0-9\-_]/g, '-');

        return `nc-evidence/${safeNcId}/${safeStepKey}/${safeFileName}`;
    };

    // Dosya boyutunu formatla
    const formatFileSize = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    useEffect(() => {
        if (evidenceFiles && evidenceFiles.length > 0) {
            setFiles(evidenceFiles);
        }
    }, [evidenceFiles]);

    const handleFileSelect = (e) => {
        const selectedFiles = Array.from(e.target.files);
        const validFiles = [];
        const errors = [];

        selectedFiles.forEach(file => {
            // Dosya adı kontrolü
            if (!file.name || file.name.trim().length === 0) {
                errors.push('Geçersiz dosya adı');
                return;
            }

            // Dosya boyutu kontrolü
            const maxSize = 50 * 1024 * 1024; // 50 MB
            if (file.size > maxSize) {
                errors.push(`${file.name} dosyası 50 MB'dan büyük (${formatFileSize(file.size)})`);
                return;
            }

            // Boş dosya kontrolü
            if (file.size === 0) {
                errors.push(`${file.name} dosyası boş`);
                return;
            }

            validFiles.push(file);
        });

        // Hataları göster
        if (errors.length > 0) {
            toast({
                variant: 'destructive',
                title: 'Dosya seçim hatası',
                description: errors.slice(0, 3).join(', ') + (errors.length > 3 ? ` ve ${errors.length - 3} hata daha...` : '')
            });
        }

        // Geçerli dosyaları ekle
        if (validFiles.length > 0) {
            setFiles(prev => [...prev, ...validFiles.map(f => ({ file: f, uploaded: false, path: null }))]);
        }

        // Input'u temizle (aynı dosyayı tekrar seçebilmek için)
        e.target.value = '';
    };

    const handleUpload = async () => {
        if (files.length === 0) return;

        setUploading(true);
        const uploadedFiles = [];

        try {
            for (const fileData of files) {
                if (fileData.uploaded && fileData.path) {
                    uploadedFiles.push(fileData);
                    continue;
                }

                const file = fileData.file;
                const originalFileName = file.name || 'unnamed-file';

                // Güvenli dosya yolu oluştur
                let filePath = createSafeFilePath(originalFileName, ncId, stepKey);

                // Safari uyumluluğu için dosyayı ArrayBuffer olarak oku
                const arrayBuffer = await file.arrayBuffer();
                const blob = new Blob([arrayBuffer], { type: file.type || 'application/octet-stream' });

                // Dosyayı storage'a yükle
                let uploadError = null;
                try {
                    const { error } = await supabase.storage
                        .from('df_attachments')
                        .upload(filePath, blob, {
                            cacheControl: '3600',
                            upsert: false,
                            contentType: file.type || 'application/octet-stream'
                        });
                    uploadError = error;
                } catch (err) {
                    uploadError = err;
                }

                if (uploadError) {
                    // Daha detaylı hata mesajı
                    const errorMessage = uploadError.message || 'Bilinmeyen hata';
                    console.error('Dosya yükleme hatası:', {
                        fileName: originalFileName,
                        filePath,
                        error: uploadError,
                        fileSize: file.size,
                        fileType: file.type
                    });

                    // Eğer dosya adı sorunluysa, tekrar normalize et ve dene
                    if (errorMessage.includes('Invalid') || errorMessage.includes('invalid') || errorMessage.includes('path')) {
                        const retryFilePath = createSafeFilePath(`file-${Date.now()}`, ncId, stepKey);
                        try {
                            const { error: retryError } = await supabase.storage
                                .from('df_attachments')
                                .upload(retryFilePath, blob, {
                                    cacheControl: '3600',
                                    upsert: false,
                                    contentType: file.type || 'application/octet-stream'
                                });

                            if (retryError) {
                                throw new Error(`${originalFileName} yüklenemedi: ${retryError.message}`);
                            }

                            // Retry başarılı, filePath'i güncelle
                            filePath = retryFilePath;
                        } catch (retryErr) {
                            throw new Error(`${originalFileName} yüklenemedi: ${retryErr.message || errorMessage}`);
                        }
                    } else {
                        throw new Error(`${originalFileName} yüklenemedi: ${errorMessage}`);
                    }
                }

                // Public URL al
                const { data: { publicUrl } } = supabase.storage
                    .from('df_attachments')
                    .getPublicUrl(filePath);

                uploadedFiles.push({
                    name: file.name,
                    path: filePath,
                    url: publicUrl,
                    type: file.type,
                    size: file.size,
                    uploaded: true,
                    uploadedAt: new Date().toISOString()
                });
            }

            setFiles(uploadedFiles);
            if (onEvidenceChange) {
                onEvidenceChange(uploadedFiles);
            }

            toast({
                title: 'Başarılı',
                description: `${uploadedFiles.length} dosya yüklendi.`
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Yükleme hatası',
                description: error.message
            });
        } finally {
            setUploading(false);
        }
    };

    const handleRemove = async (index) => {
        const fileToRemove = files[index];

        if (fileToRemove.uploaded && fileToRemove.path) {
            try {
                const { error } = await supabase.storage
                    .from('df_attachments')
                    .remove([fileToRemove.path]);

                if (error) throw error;
            } catch (error) {
                toast({
                    variant: 'destructive',
                    title: 'Silme hatası',
                    description: error.message
                });
                return;
            }
        }

        const newFiles = files.filter((_, i) => i !== index);
        setFiles(newFiles);
        if (onEvidenceChange) {
            onEvidenceChange(newFiles);
        }
    };

    // Dosya uzantısından MIME tipini belirle
    const getFileTypeFromExtension = (fileName) => {
        if (!fileName) return 'application/octet-stream';

        const ext = fileName.split('.').pop()?.toLowerCase();
        const mimeTypes = {
            // Resimler
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'bmp': 'image/bmp',
            'svg': 'image/svg+xml',
            'heic': 'image/heic',
            'heif': 'image/heif',
            'tiff': 'image/tiff',
            'tif': 'image/tiff',
            // Videolar
            'mp4': 'video/mp4',
            'webm': 'video/webm',
            'ogg': 'video/ogg',
            'mov': 'video/quicktime',
            'avi': 'video/x-msvideo',
            'mkv': 'video/x-matroska',
            // Dokümanlar
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'ppt': 'application/vnd.ms-powerpoint',
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'txt': 'text/plain',
        };

        return mimeTypes[ext] || 'application/octet-stream';
    };

    const handlePreview = async (file) => {
        // Dosya tipini belirle - önce file.type, yoksa dosya adından
        const fileName = file.name || file.path?.split('/').pop() || '';
        const effectiveType = file.type || getFileTypeFromExtension(fileName);

        if (file.uploaded && file.path) {
            try {
                const { data, error } = await supabase.storage
                    .from('df_attachments')
                    .createSignedUrl(file.path, 3600);

                if (error) throw error;

                setPreviewUrl(data.signedUrl);
                setPreviewType(effectiveType);
            } catch (error) {
                toast({
                    variant: 'destructive',
                    title: 'Önizleme hatası',
                    description: error.message
                });
            }
        } else {
            const url = URL.createObjectURL(file.file);
            setPreviewUrl(url);
            setPreviewType(effectiveType);
        }
    };

    const getFileIcon = (type, name) => {
        // Tip yoksa dosya adından belirle
        const effectiveType = type || getFileTypeFromExtension(name);
        if (effectiveType?.startsWith('image/')) return <Image className="h-5 w-5" />;
        if (effectiveType?.startsWith('video/')) return <Video className="h-5 w-5" />;
        return <FileText className="h-5 w-5" />;
    };

    return (
        <>
            <Card className="mt-4">
                <CardContent className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">Kanıt Dosyaları (Fotoğraf, Video, Doküman)</Label>
                        <Badge variant="outline">{files.length} dosya</Badge>
                    </div>

                    {/* Dosya Seçme */}
                    <div className="flex items-center gap-2">
                        <Input
                            type="file"
                            multiple
                            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.tar,.gz"
                            onChange={handleFileSelect}
                            className="flex-1"
                            disabled={uploading}
                        />
                        {files.length > 0 && (
                            <Button
                                type="button"
                                onClick={handleUpload}
                                disabled={uploading || files.every(f => f.uploaded)}
                            >
                                <UploadCloud className="h-4 w-4 mr-2" />
                                {uploading ? 'Yükleniyor...' : 'Yükle'}
                            </Button>
                        )}
                    </div>

                    {/* Dosya Listesi */}
                    {files.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {files.map((file, index) => (
                                <div
                                    key={index}
                                    className="relative group border rounded-lg p-2 hover:bg-muted transition-colors"
                                >
                                    <div className="flex flex-col items-center gap-2">
                                        {getFileIcon(file.type || file.file?.type, file.name)}
                                        <span className="text-xs text-center truncate w-full" title={file.name}>
                                            {file.name || file.file?.name}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {formatFileSize(file.size || file.file?.size)}
                                        </span>
                                        {file.uploaded && (
                                            <Badge variant="success" className="text-xs">Yüklendi</Badge>
                                        )}
                                    </div>
                                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => handlePreview(file)}
                                        >
                                            <Eye className="h-3 w-3" />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-destructive"
                                            onClick={() => handleRemove(index)}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Önizleme Modal */}
            <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
                <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                    <DialogHeader>
                        <DialogTitle>Dosya Önizleme</DialogTitle>
                    </DialogHeader>
                    <div className="mt-4">
                        {previewType?.startsWith('image/') ? (
                            <img src={previewUrl} alt="Önizleme" className="max-w-full max-h-[70vh] mx-auto" />
                        ) : previewType?.startsWith('video/') ? (
                            <video src={previewUrl} controls className="max-w-full max-h-[70vh] mx-auto" />
                        ) : (
                            <iframe src={previewUrl} className="w-full h-[70vh] border rounded" />
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default EvidenceUploader;

