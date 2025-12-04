import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const FMEADetailView = ({ project, onBack }) => {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4">
                <Button variant="outline" onClick={onBack}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Geri
                </Button>
                <div>
                    <h2 className="text-2xl font-bold">{project.fmea_name}</h2>
                    <p className="text-muted-foreground">{project.fmea_number}</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>FMEA Detayları</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center text-muted-foreground py-12">
                        FMEA detay görüntüleme (Fonksiyonlar, Hata Modları, Kök Nedenler, RPN hesaplama, Aksiyon Planları) yakında eklenecek.
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default FMEADetailView;

