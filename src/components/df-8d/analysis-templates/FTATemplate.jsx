import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, X, AlertTriangle, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const FTATemplate = ({ analysisData, onAnalysisChange }) => {
    const [data, setData] = useState(analysisData || {
        topEvent: '',
        events: []
    });

    const handleTopEventChange = (value) => {
        const newData = { ...data, topEvent: value };
        setData(newData);
        if (onAnalysisChange) {
            onAnalysisChange(newData);
        }
    };

    const handleAddEvent = () => {
        const newEvent = {
            id: Date.now().toString(),
            description: '',
            type: 'intermediate', // 'basic', 'intermediate', 'top'
            gate: 'OR', // 'OR', 'AND'
            causes: []
        };
        const newData = {
            ...data,
            events: [...(data.events || []), newEvent]
        };
        setData(newData);
        if (onAnalysisChange) {
            onAnalysisChange(newData);
        }
    };

    const handleRemoveEvent = (eventId) => {
        const newData = {
            ...data,
            events: data.events.filter(e => e.id !== eventId)
        };
        setData(newData);
        if (onAnalysisChange) {
            onAnalysisChange(newData);
        }
    };

    const handleEventChange = (eventId, field, value) => {
        const newData = {
            ...data,
            events: data.events.map(e => 
                e.id === eventId ? { ...e, [field]: value } : e
            )
        };
        setData(newData);
        if (onAnalysisChange) {
            onAnalysisChange(newData);
        }
    };

    const handleAddCause = (eventId) => {
        const newData = {
            ...data,
            events: data.events.map(e => 
                e.id === eventId 
                    ? { ...e, causes: [...(e.causes || []), ''] }
                    : e
            )
        };
        setData(newData);
        if (onAnalysisChange) {
            onAnalysisChange(newData);
        }
    };

    const handleRemoveCause = (eventId, causeIndex) => {
        const newData = {
            ...data,
            events: data.events.map(e => 
                e.id === eventId 
                    ? { ...e, causes: e.causes.filter((_, i) => i !== causeIndex) }
                    : e
            )
        };
        setData(newData);
        if (onAnalysisChange) {
            onAnalysisChange(newData);
        }
    };

    const handleCauseChange = (eventId, causeIndex, value) => {
        const newData = {
            ...data,
            events: data.events.map(e => 
                e.id === eventId 
                    ? { 
                        ...e, 
                        causes: e.causes.map((c, i) => i === causeIndex ? value : c)
                    }
                    : e
            )
        };
        setData(newData);
        if (onAnalysisChange) {
            onAnalysisChange(newData);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-primary" />
                    FTA (Fault Tree Analysis) - Hata Ağacı Analizi
                </CardTitle>
                <CardDescription>
                    Sistem hatalarının mantıksal ilişkilerini analiz edin
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Top Event */}
                <div className="space-y-2">
                    <Label htmlFor="topEvent">
                        Top Event (Ana Olay) <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                        id="topEvent"
                        value={data.topEvent || ''}
                        onChange={(e) => handleTopEventChange(e.target.value)}
                        placeholder="Analiz edilecek ana hatayı/olayı tanımlayın..."
                        rows={2}
                        className="font-semibold border-2"
                    />
                    <p className="text-xs text-muted-foreground">
                        Sistemde meydana gelen istenmeyen ana olay
                    </p>
                </div>

                {/* Events */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">Ara Olaylar ve Temel Nedenler</Label>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleAddEvent}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Olay Ekle
                        </Button>
                    </div>

                    {data.events && data.events.length > 0 ? (
                        <div className="space-y-4">
                            {data.events.map((event, eventIndex) => (
                                <Card key={event.id} className="bg-muted/50">
                                    <CardContent className="p-4 space-y-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="secondary">Olay {eventIndex + 1}</Badge>
                                                    <select
                                                        value={event.gate || 'OR'}
                                                        onChange={(e) => handleEventChange(event.id, 'gate', e.target.value)}
                                                        className="text-xs border rounded px-2 py-1"
                                                    >
                                                        <option value="OR">VEYA (OR)</option>
                                                        <option value="AND">VE (AND)</option>
                                                    </select>
                                                </div>
                                                <Textarea
                                                    value={event.description || ''}
                                                    onChange={(e) => handleEventChange(event.id, 'description', e.target.value)}
                                                    placeholder="Olay açıklaması..."
                                                    rows={2}
                                                />
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleRemoveEvent(event.id)}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        {/* Causes */}
                                        <div className="ml-4 space-y-2 border-l-2 border-primary/30 pl-4">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-xs">Temel Nedenler:</Label>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 text-xs"
                                                    onClick={() => handleAddCause(event.id)}
                                                >
                                                    <Plus className="h-3 w-3 mr-1" />
                                                    Neden Ekle
                                                </Button>
                                            </div>
                                            {event.causes && event.causes.length > 0 ? (
                                                <div className="space-y-2">
                                                    {event.causes.map((cause, causeIndex) => (
                                                        <div key={causeIndex} className="flex items-start gap-2">
                                                            <Minus className="h-4 w-4 mt-1 text-muted-foreground" />
                                                            <Input
                                                                value={cause}
                                                                onChange={(e) => handleCauseChange(event.id, causeIndex, e.target.value)}
                                                                placeholder="Temel neden..."
                                                                className="text-sm"
                                                            />
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                onClick={() => handleRemoveCause(event.id, causeIndex)}
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-muted-foreground italic">
                                                    Henüz temel neden eklenmedi
                                                </p>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            Henüz olay eklenmedi. "Olay Ekle" butonuna tıklayarak başlayın.
                        </div>
                    )}
                </div>

                {/* Özet */}
                {data.topEvent && (
                    <div className="mt-6 p-4 bg-muted rounded-lg">
                        <h4 className="font-semibold mb-3">FTA Analiz Özeti</h4>
                        <div className="space-y-2 text-sm">
                            <div>
                                <span className="font-medium">Top Event:</span>
                                <p className="mt-1">{data.topEvent}</p>
                            </div>
                            {data.events && data.events.length > 0 && (
                                <div className="mt-3">
                                    <span className="font-medium">Olaylar ({data.events.length}):</span>
                                    <ul className="list-disc list-inside mt-1 space-y-1 text-muted-foreground">
                                        {data.events.map((event, idx) => (
                                            <li key={idx}>
                                                <span className="font-medium">[{event.gate || 'OR'}]</span> {event.description || 'Açıklama yok'}
                                                {event.causes && event.causes.filter(c => c.trim()).length > 0 && (
                                                    <span className="ml-2 text-xs">
                                                        ({event.causes.filter(c => c.trim()).length} temel neden)
                                                    </span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            <div className="mt-3 flex items-center gap-2">
                                <Badge variant="secondary">
                                    Toplam {data.events?.reduce((sum, e) => sum + (e.causes?.filter(c => c.trim()).length || 0), 0) || 0} temel neden
                                </Badge>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default FTATemplate;

