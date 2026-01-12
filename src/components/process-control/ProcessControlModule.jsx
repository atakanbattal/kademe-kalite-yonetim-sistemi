import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from 'framer-motion';
import ProcessControlDashboard from './ProcessControlDashboard';
import EquipmentManagement from './EquipmentManagement';
import DocumentManagement from './DocumentManagement';
import ControlPlanManagement from './ControlPlanManagement';
import NotesManagement from './NotesManagement';

const ProcessControlModule = ({ onOpenNCForm, onOpenNCView }) => {
    const { toast } = useToast();
    const [equipment, setEquipment] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [plans, setPlans] = useState([]);
    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('dashboard');

    const fetchEquipment = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('process_control_equipment')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) {
                // Tablo yoksa veya RLS hatası varsa daha açıklayıcı mesaj
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    console.warn('process_control_equipment tablosu henüz oluşturulmamış');
                    setEquipment([]);
                    return;
                }
                throw error;
            }
            setEquipment(data || []);
        } catch (err) {
            console.error('Ekipman yükleme hatası:', err);
            // Sadece kritik hatalarda toast göster
            if (err.code !== '42P01' && !err.message.includes('does not exist')) {
                toast({ 
                    variant: 'destructive', 
                    title: 'Hata', 
                    description: 'Ekipmanlar yüklenemedi: ' + (err.message || 'Bilinmeyen hata')
                });
            }
            setEquipment([]);
        }
    }, [toast]);

    const fetchDocuments = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('process_control_documents')
                .select('*, process_control_equipment(equipment_code, equipment_name)')
                .order('created_at', { ascending: false });
            
            if (error) {
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    console.warn('process_control_documents tablosu henüz oluşturulmamış');
                    setDocuments([]);
                    return;
                }
                throw error;
            }
            setDocuments(data || []);
        } catch (err) {
            console.error('Doküman yükleme hatası:', err);
            setDocuments([]);
        }
    }, []);

    const fetchPlans = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('process_control_plans')
                .select('*, process_control_equipment(equipment_code, equipment_name)')
                .order('updated_at', { ascending: false });
            
            if (error) {
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    console.warn('process_control_plans tablosu henüz oluşturulmamış');
                    setPlans([]);
                    return;
                }
                throw error;
            }
            setPlans(data || []);
        } catch (err) {
            console.error('Kontrol planı yükleme hatası:', err);
            setPlans([]);
        }
    }, []);

    const fetchNotes = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('process_control_notes')
                .select('*, process_control_equipment(equipment_code, equipment_name), process_control_documents(document_name, document_number)')
                .order('created_at', { ascending: false });
            
            if (error) {
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    console.warn('process_control_notes tablosu henüz oluşturulmamış');
                    setNotes([]);
                    return;
                }
                throw error;
            }
            setNotes(data || []);
        } catch (err) {
            console.error('Not yükleme hatası:', err);
            setNotes([]);
        }
    }, []);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            await Promise.all([
                fetchEquipment(),
                fetchDocuments(),
                fetchPlans(),
                fetchNotes()
            ]);
            setLoading(false);
        };
        loadData();
    }, [fetchEquipment, fetchDocuments, fetchPlans, fetchNotes]);

    return (
        <>
            <Helmet>
                <title>Kademe A.Ş. Kalite Yönetim Sistemi</title>
            </Helmet>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">Proses Kontrol Yönetimi</h1>
                        <p className="text-muted-foreground mt-1">
                            Üretim araçlarının dokümanları, kontrol planları ve kalite bulgularını yönetin.
                        </p>
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="dashboard">Ana Ekran</TabsTrigger>
                        <TabsTrigger value="equipment">Araçlar</TabsTrigger>
                        <TabsTrigger value="documents">Dokümanlar</TabsTrigger>
                        <TabsTrigger value="plans">Kontrol Planları</TabsTrigger>
                        <TabsTrigger value="notes">Notlar</TabsTrigger>
                    </TabsList>

                    <TabsContent value="dashboard" className="mt-6">
                        <ProcessControlDashboard 
                            equipment={equipment}
                            documents={documents}
                            plans={plans}
                            notes={notes}
                            loading={loading}
                            onOpenNCForm={onOpenNCForm}
                            refreshNotes={fetchNotes}
                            onTabChange={setActiveTab}
                        />
                    </TabsContent>

                    <TabsContent value="equipment" className="mt-6">
                        <EquipmentManagement 
                            equipment={equipment}
                            loading={loading}
                            refreshEquipment={fetchEquipment}
                        />
                    </TabsContent>

                    <TabsContent value="documents" className="mt-6">
                        <DocumentManagement 
                            equipment={equipment}
                            documents={documents}
                            loading={loading}
                            refreshDocuments={fetchDocuments}
                            refreshEquipment={fetchEquipment}
                        />
                    </TabsContent>

                    <TabsContent value="plans" className="mt-6">
                        <ControlPlanManagement 
                            equipment={equipment}
                            plans={plans}
                            loading={loading}
                            refreshPlans={fetchPlans}
                            refreshEquipment={fetchEquipment}
                        />
                    </TabsContent>

                    <TabsContent value="notes" className="mt-6">
                        <NotesManagement 
                            equipment={equipment}
                            documents={documents}
                            notes={notes}
                            loading={loading}
                            refreshNotes={fetchNotes}
                            refreshEquipment={fetchEquipment}
                            refreshDocuments={fetchDocuments}
                            onOpenNCForm={onOpenNCForm}
                        />
                    </TabsContent>
                </Tabs>
            </div>
        </>
    );
};

export default ProcessControlModule;

