import React, { useState } from 'react';
import { Upload, X, File, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const BenchmarkDocumentUpload = ({ benchmarkId, benchmarkItemId = null, onUploadSuccess }) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const [uploading, setUploading] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [documentData, setDocumentData] = useState({
        document_type: 'Diğer',
        document_title: '',
        description: '',
        document_date: '',
        document_number: '',
        tags: []
    });
    const [tagInput, setTagInput] = useState('');

    const documentTypes = [
        'Teknik Şartname',
        'Teklif',
        'Test Raporu',
        'Sertifika',
        'Fotoğraf',
        'Sunum',
        'Analiz Raporu',
        'Referans Doküman',
        'Diğer'
    ];

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        const validFiles = files.filter(file => {
            if (file.size > 10 * 1024 * 1024) {
                toast({
                    variant: 'destructive',
                    title: 'Dosya Çok Büyük',
                    description: `${file.name} dosyası 10 MB'dan büyük olamaz.`
                });
                return false;
            }
            return true;
        });
        setSelectedFiles([...selectedFiles, ...validFiles]);
    };

    const handleRemoveFile = (index) => {
        setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
    };

    const handleAddTag = (e) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            e.preventDefault();
            if (!documentData.tags.includes(tagInput.trim())) {
                setDocumentData(prev => ({
                    ...prev,
                    tags: [...prev.tags, tagInput.trim()]
                }));
            }
            setTagInput('');
        }
    };

    const handleRemoveTag = (tagToRemove) => {
        setDocumentData(prev => ({
            ...prev,
            tags: prev.tags.filter(tag => tag !== tagToRemove)
        }));
    };

    const handleUpload = async () => {
        if (selectedFiles.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Lütfen en az bir dosya seçin.'
            });
            return;
        }

        if (!documentData.document_title.trim()) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Doküman başlığı zorunludur.'
            });
            return;
        }

        setUploading(true);

        try {
            const uploadedDocs = [];

            for (const file of selectedFiles) {
                // Upload to storage
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
                const filePath = `${benchmarkId}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('documents')
                    .upload(`benchmark-documents/${filePath}`, file, {
                        contentType: file.type,
                        upsert: false
                    });

                if (uploadError) throw uploadError;

                // Get public URL
                const fullFilePath = `benchmark-documents/${filePath}`;
                const { data: { publicUrl } } = supabase.storage
                    .from('documents')
                    .getPublicUrl(fullFilePath);

                // Save metadata to database
                const { data, error: dbError } = await supabase
                    .from('benchmark_documents')
                    .insert({
                        benchmark_id: benchmarkId,
                        benchmark_item_id: benchmarkItemId,
                        document_type: documentData.document_type,
                        document_title: documentData.document_title,
                        description: documentData.description,
                        file_path: fullFilePath,
                        file_url: publicUrl,
                        file_name: file.name,
                        file_type: file.type,
                        file_size: file.size,
                        document_date: documentData.document_date || null,
                        document_number: documentData.document_number || null,
                        tags: documentData.tags,
                        uploaded_by: user?.id
                    })
                    .select()
                    .single();

                if (dbError) throw dbError;
                uploadedDocs.push(data);
            }

            toast({
                title: 'Başarılı',
                description: `${uploadedDocs.length} doküman başarıyla yüklendi.`
            });

            // Reset form
            setSelectedFiles([]);
            setDocumentData({
                document_type: 'Diğer',
                document_title: '',
                description: '',
                document_date: '',
                document_number: '',
                tags: []
            });

            if (onUploadSuccess) {
                onUploadSuccess(uploadedDocs);
            }
        } catch (error) {
            console.error('Yükleme hatası:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Doküman yüklenirken bir hata oluştu: ' + error.message
            });
        } finally {
            setUploading(false);
        }
    };

    const getFileIcon = (file) => {
        if (file.type.startsWith('image/')) {
            return <ImageIcon className="h-8 w-8 text-blue-500" />;
        }
        return <File className="h-8 w-8 text-gray-500" />;
    };

    return (
        <div className="space-y-4">
            {/* File Selection */}
            <div>
                <Label htmlFor="file-upload">Dosya Seç</Label>
                <div className="mt-2">
                    <label
                        htmlFor="file-upload"
                        className="flex items-center justify-center w-full h-32 px-4 transition bg-white border-2 border-gray-300 border-dashed rounded-md appearance-none cursor-pointer hover:border-gray-400 focus:outline-none"
                    >
                        <div className="flex flex-col items-center space-y-2">
                            <Upload className="h-8 w-8 text-gray-400" />
                            <span className="font-medium text-gray-600">
                                Dosya seçmek için tıklayın veya sürükleyin
                            </span>
                            <span className="text-xs text-gray-500">
                                Max 10 MB - PDF, Word, Excel, Resim dosyaları
                            </span>
                        </div>
                        <input
                            id="file-upload"
                            type="file"
                            className="hidden"
                            multiple
                            onChange={handleFileSelect}
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif"
                        />
                    </label>
                </div>
            </div>

            {/* Selected Files */}
            {selectedFiles.length > 0 && (
                <div className="space-y-2">
                    <Label>Seçilen Dosyalar ({selectedFiles.length})</Label>
                    {selectedFiles.map((file, index) => (
                        <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                            <div className="flex items-center gap-3">
                                {getFileIcon(file)}
                                <div>
                                    <p className="text-sm font-medium">{file.name}</p>
                                    <p className="text-xs text-gray-500">
                                        {(file.size / 1024).toFixed(1)} KB
                                    </p>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRemoveFile(index)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            {/* Document Metadata */}
            <div className="grid gap-4 md:grid-cols-2">
                <div>
                    <Label htmlFor="document_type">
                        Doküman Tipi <span className="text-red-500">*</span>
                    </Label>
                    <Select
                        value={documentData.document_type}
                        onValueChange={(value) => setDocumentData(prev => ({ ...prev, document_type: value }))}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {documentTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                    {type}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label htmlFor="document_title">
                        Doküman Başlığı <span className="text-red-500">*</span>
                    </Label>
                    <Input
                        id="document_title"
                        value={documentData.document_title}
                        onChange={(e) => setDocumentData(prev => ({ ...prev, document_title: e.target.value }))}
                        placeholder="Doküman başlığı"
                    />
                </div>
            </div>

            <div>
                <Label htmlFor="description">Açıklama</Label>
                <Textarea
                    id="description"
                    value={documentData.description}
                    onChange={(e) => setDocumentData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Doküman hakkında açıklama"
                    rows={3}
                />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div>
                    <Label htmlFor="document_date">Doküman Tarihi</Label>
                    <Input
                        id="document_date"
                        type="date"
                        value={documentData.document_date}
                        onChange={(e) => setDocumentData(prev => ({ ...prev, document_date: e.target.value }))}
                    />
                </div>

                <div>
                    <Label htmlFor="document_number">Doküman Numarası</Label>
                    <Input
                        id="document_number"
                        value={documentData.document_number}
                        onChange={(e) => setDocumentData(prev => ({ ...prev, document_number: e.target.value }))}
                        placeholder="Örn: DOC-2024-001"
                    />
                </div>
            </div>

            <div>
                <Label htmlFor="tags">Etiketler</Label>
                <Input
                    id="tags"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleAddTag}
                    placeholder="Etiket eklemek için yazın ve Enter'a basın"
                />
                {documentData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {documentData.tags.map((tag, idx) => (
                            <Badge
                                key={idx}
                                variant="secondary"
                                className="cursor-pointer"
                                onClick={() => handleRemoveTag(tag)}
                            >
                                {tag}
                                <X className="ml-1 h-3 w-3" />
                            </Badge>
                        ))}
                    </div>
                )}
            </div>

            {/* Upload Button */}
            <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                    onClick={handleUpload}
                    disabled={uploading || selectedFiles.length === 0}
                >
                    {uploading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Yükleniyor...
                        </>
                    ) : (
                        <>
                            <Upload className="mr-2 h-4 w-4" />
                            Yükle
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
};

export default BenchmarkDocumentUpload;

