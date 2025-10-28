import React from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';

export const CreateNCModal = ({ cost, onOpenNCForm, onNCDCreated }) => {
    const { toast } = useToast();

    const handleCreateNC = (type) => {
        toast({
            variant: 'destructive',
            title: 'Özellik Devre Dışı',
            description: 'Bu özellik şu anda devre dışıdır.'
        });
    };

    return (
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle className="text-foreground">Uygunsuzluk Raporu Oluştur</AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground">
                    Bu özellik şu anda devre dışıdır.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>İptal</AlertDialogCancel>
                <Button variant="secondary" onClick={() => handleCreateNC('DF')}>
                    DF Oluştur
                </Button>
                <Button onClick={() => handleCreateNC('8D')}>
                    8D Oluştur
                </Button>
            </AlertDialogFooter>
        </AlertDialogContent>
    );
};