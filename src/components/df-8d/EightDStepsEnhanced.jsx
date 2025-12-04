import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Lock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import EvidenceUploader from './EvidenceUploader';

const EightDStepsEnhanced = ({ steps, onStepsChange, isEditMode = false, ncId = null }) => {
    const [expandedSteps, setExpandedSteps] = useState(new Set(['D1'])); // İlk adım açık

    // Adım tamamlanma kontrolü
    const isStepCompleted = (stepKey, step) => {
        // JSONB formatından gelen veriler için kontrol
        if (step.completed !== undefined) {
            return step.completed === true && !!(step.responsible && step.completionDate && step.description);
        }
        // Eski format için geriye dönük uyumluluk
        return !!(step.responsible && step.completionDate && step.description);
    };

    // Önceki adım tamamlanmış mı kontrolü
    const isPreviousStepCompleted = (stepKey) => {
        const stepOrder = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'];
        const currentIndex = stepOrder.indexOf(stepKey);
        
        if (currentIndex === 0) return true; // İlk adım her zaman erişilebilir
        
        const previousStepKey = stepOrder[currentIndex - 1];
        const previousStep = steps[previousStepKey];
        
        return isStepCompleted(previousStepKey, previousStep);
    };

    // Adım erişilebilir mi kontrolü
    const isStepAccessible = (stepKey) => {
        if (!isEditMode) return true; // Yeni kayıt oluştururken tüm adımlar erişilebilir
        return isPreviousStepCompleted(stepKey);
    };

    const handleStepChange = (stepKey, field, value) => {
        const currentStep = steps[stepKey] || {};
        const newStep = {
            ...currentStep,
            [field]: value,
        };
        
        // Eğer tüm zorunlu alanlar doldurulduysa completed'i true yap
        if (field === 'description' || field === 'responsible' || field === 'completionDate') {
            if (newStep.responsible && newStep.completionDate && newStep.description) {
                newStep.completed = true;
            } else {
                newStep.completed = false;
            }
        }
        
        const newSteps = {
            ...steps,
            [stepKey]: newStep,
        };
        onStepsChange(newSteps);
    };

    const toggleStep = (stepKey) => {
        if (!isStepAccessible(stepKey)) return;
        
        const newExpanded = new Set(expandedSteps);
        if (newExpanded.has(stepKey)) {
            newExpanded.delete(stepKey);
        } else {
            newExpanded.add(stepKey);
        }
        setExpandedSteps(newExpanded);
    };

    const stepOrder = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'];

    return (
        <div className="space-y-4 p-1">
            {stepOrder.map((key, index) => {
                const step = steps[key] || {};
                const completed = isStepCompleted(key, step);
                const accessible = isStepAccessible(key);
                const isExpanded = expandedSteps.has(key);
                const isLocked = !accessible && isEditMode;

                return (
                    <Card 
                        key={key} 
                        className={cn(
                            "bg-background/50 transition-all",
                            completed && "border-green-500 border-l-4",
                            isLocked && "opacity-60 border-l-4 border-gray-400",
                            !isLocked && !completed && "border-l-4 border-yellow-500"
                        )}
                    >
                        <CardHeader 
                            className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => toggleStep(key)}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                                        completed && "bg-green-500 text-white",
                                        isLocked && "bg-gray-400 text-white",
                                        !isLocked && !completed && "bg-yellow-500 text-white"
                                    )}>
                                        {completed ? <CheckCircle2 className="w-5 h-5" /> : index + 1}
                                    </div>
                                    <div>
                                        <CardTitle className="text-md text-primary flex items-center gap-2">
                                            {key}: {step.title || getDefaultTitle(key)}
                                            {isLocked && <Lock className="w-4 h-4 text-gray-400" />}
                                        </CardTitle>
                                        {!accessible && isEditMode && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Önceki adımı tamamlamanız gerekiyor
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {completed && (
                                        <Badge variant="default" className="bg-green-500">
                                            Tamamlandı
                                        </Badge>
                                    )}
                                    {!accessible && isEditMode && (
                                        <Badge variant="secondary">
                                            Kilitli
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        
                        {isExpanded && accessible && (
                            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor={`responsible-${key}`}>
                                        Sorumlu <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id={`responsible-${key}`}
                                        value={step.responsible || ''}
                                        onChange={(e) => handleStepChange(key, 'responsible', e.target.value)}
                                        placeholder="Sorumlu kişi veya departman..."
                                        disabled={isLocked}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor={`completionDate-${key}`}>
                                        Tamamlanma Tarihi <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id={`completionDate-${key}`}
                                        type="date"
                                        value={step.completionDate || ''}
                                        onChange={(e) => handleStepChange(key, 'completionDate', e.target.value)}
                                        disabled={isLocked}
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <Label htmlFor={`description-${key}`}>
                                        Açıklama / Yapılan Çalışmalar <span className="text-red-500">*</span>
                                    </Label>
                                    <Textarea
                                        id={`description-${key}`}
                                        value={step.description || ''}
                                        onChange={(e) => handleStepChange(key, 'description', e.target.value)}
                                        placeholder="Bu adımda yapılan çalışmaları ve alınan kararları detaylandırın..."
                                        rows={4}
                                        disabled={isLocked}
                                    />
                                </div>
                                {completed && (
                                    <div className="md:col-span-2 flex items-center gap-2 text-sm text-green-600">
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span>Bu adım tamamlandı. Bir sonraki adıma geçebilirsiniz.</span>
                                    </div>
                                )}
                                
                                {/* Kanıt Yükleme */}
                                {ncId && (
                                    <div className="md:col-span-2">
                                        <EvidenceUploader
                                            stepKey={key}
                                            ncId={ncId}
                                            evidenceFiles={step.evidenceFiles || []}
                                            onEvidenceChange={(files) => {
                                                handleStepChange(key, 'evidenceFiles', files);
                                            }}
                                        />
                                    </div>
                                )}
                            </CardContent>
                        )}
                    </Card>
                );
            })}
        </div>
    );
};

// Varsayılan başlıklar
const getDefaultTitle = (stepKey) => {
    const titles = {
        D1: "Ekip Oluşturma",
        D2: "Problemi Tanımlama",
        D3: "Geçici Önlemler Alma",
        D4: "Kök Neden Analizi",
        D5: "Kalıcı Düzeltici Faaliyetleri Belirleme",
        D6: "Kalıcı Düzeltici Faaliyetleri Uygulama",
        D7: "Tekrarlanmayı Önleme",
        D8: "Ekibi Takdir Etme"
    };
    return titles[stepKey] || stepKey;
};

export default EightDStepsEnhanced;

