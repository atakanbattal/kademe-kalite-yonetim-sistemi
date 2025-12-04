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

    useEffect(() => {
        if (evidenceFiles && evidenceFiles.length > 0) {
            setFiles(evidenceFiles);
        }
    }, [evidenceFiles]);

    const handleFileSelect = (e) => {
        const selectedFiles = Array.from(e.target.files);
        const validFiles = selectedFiles.filter(file => {
            const maxSize = 50 * 1024 * 1024; // 50 MB
            if (file.size > maxSize) {
                toast({
                    variant: 'destructive',
                    title: 'Dosya çok büyük',
                    description: `${file.name} dosyası 50 MB'dan büyük olamaz.`
                });
                return false;
            }
            return true;
        });
        setFiles(prev => [...prev, ...validFiles.map(f => ({ file: f, uploaded: false, path: null }))]);
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
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
                const filePath = `nc-evidence/${ncId}/${stepKey}/${fileName}`;

                // Dosyayı storage'a yükle
                const { error: uploadError } = await supabase.storage
                    .from('df_attachments')
                    .upload(filePath, file, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (uploadError) {
                    throw new Error(`${file.name} yüklenemedi: ${uploadError.message}`);
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

    const handlePreview = async (file) => {
        if (file.uploaded && file.path) {
            try {
                const { data, error } = await supabase.storage
                    .from('df_attachments')
                    .createSignedUrl(file.path, 3600);
                
                if (error) throw error;
                
                setPreviewUrl(data.signedUrl);
                setPreviewType(file.type);
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
            setPreviewType(file.type);
        }
    };

    const getFileIcon = (type, name) => {
        if (type?.startsWith('image/')) return <Image className="h-5 w-5" />;
        if (type?.startsWith('video/')) return <Video className="h-5 w-5" />;
        return <FileText className="h-5 w-5" />;
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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
                            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
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
                <DialogContent className="max-w-4xl">
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

