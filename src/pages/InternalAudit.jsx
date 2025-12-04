import React from 'react';
import { Helmet } from 'react-helmet';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { motion } from 'framer-motion';

const InternalAudit = () => {
  const { toast } = useToast();

  const showNotImplementedToast = () => {
    toast({
      title: "🚧 Özellik Henüz Geliştirilmedi!",
      description: "Ama endişelenmeyin! Bir sonraki isteğinizde bu özelliği talep edebilirsiniz! 🚀",
      variant: "destructive",
    });
  };

  return (
    <>
      <Helmet>
        <title>İç Tetkik Yönetimi - Kademe Kalite Yönetimi</title>
        <meta name="description" content="Yıllık denetim planı ve tetkik yönetimi." />
      </Helmet>
      <motion.div 
        className="text-white"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold mb-4">İç Tetkik Yönetimi</h1>
        <p className="mb-8 text-gray-400">Bu modül şu anda geliştirme aşamasındadır.</p>
        <Button onClick={showNotImplementedToast}>Örnek Aksiyon</Button>
      </motion.div>
    </>
  );
};

export default InternalAudit;