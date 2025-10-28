import React from 'react';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
    import { GraduationCap, BookOpen, ClipboardCheck, BarChart2, CheckSquare, Award, UserCheck } from 'lucide-react';
    import { motion } from 'framer-motion';
    import TrainingPlansTab from '@/components/training/TrainingPlansTab';
    import TrainingDocumentsTab from '@/components/training/TrainingDocumentsTab';
    import TrainingExamsTab from '@/components/training/TrainingExamsTab';
    import TrainingReportsTab from '@/components/training/TrainingReportsTab';
    import ExamResultsTab from '@/components/training/ExamResultsTab';
    import AttendanceTab from '@/components/training/AttendanceTab';
    import CertificateTab from '@/components/training/CertificateTab';

    const tabContentVariants = {
        hidden: { opacity: 0, x: -20 },
        visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: 'easeOut' } }
    };

    const TrainingModule = ({ onOpenPdfViewer }) => {
        return (
            <div className="p-4 md:p-6">
                <Tabs defaultValue="plans" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
                        <TabsTrigger value="plans"><GraduationCap className="mr-2 h-4 w-4" />Planlama</TabsTrigger>
                        <TabsTrigger value="documents"><BookOpen className="mr-2 h-4 w-4" />Dokümanlar</TabsTrigger>
                        <TabsTrigger value="exams"><ClipboardCheck className="mr-2 h-4 w-4" />Sınavlar</TabsTrigger>
                        <TabsTrigger value="results"><CheckSquare className="mr-2 h-4 w-4" />Sonuçlar</TabsTrigger>
                        <TabsTrigger value="attendance"><UserCheck className="mr-2 h-4 w-4" />Katılım</TabsTrigger>
                        <TabsTrigger value="reports"><BarChart2 className="mr-2 h-4 w-4" />Raporlar</TabsTrigger>
                        <TabsTrigger value="certificates"><Award className="mr-2 h-4 w-4" />Sertifikalar</TabsTrigger>
                    </TabsList>
                    
                    <motion.div initial="hidden" animate="visible" variants={tabContentVariants}>
                        <TabsContent value="plans" className="mt-4"><TrainingPlansTab /></TabsContent>
                        <TabsContent value="documents" className="mt-4"><TrainingDocumentsTab onOpenPdfViewer={onOpenPdfViewer} /></TabsContent>
                        <TabsContent value="exams" className="mt-4"><TrainingExamsTab /></TabsContent>
                        <TabsContent value="results" className="mt-4"><ExamResultsTab /></TabsContent>
                        <TabsContent value="attendance" className="mt-4"><AttendanceTab /></TabsContent>
                        <TabsContent value="reports" className="mt-4"><TrainingReportsTab /></TabsContent>
                        <TabsContent value="certificates" className="mt-4"><CertificateTab /></TabsContent>
                    </motion.div>
                </Tabs>
            </div>
        );
    };

    export default TrainingModule;