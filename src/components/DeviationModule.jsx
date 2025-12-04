import React from 'react';
import { motion } from 'framer-motion';
import { GitPullRequest } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const deviationData = [
  { id: 1, no: 'DEV-2024-001', title: 'Kaynak Parametresi Sapması', status: 'Onaylandı', priority: 'Orta' },
  { id: 2, no: 'DEV-2024-002', title: 'Boya Kalınlığı Sapması', status: 'Beklemede', priority: 'Yüksek' },
  { id: 3, no: 'DEV-2024-003', title: 'Montaj Sırası Değişikliği', status: 'Reddedildi', priority: 'Düşük' },
  { id: 4, no: 'DEV-2024-004', title: 'Test Parametresi Sapması', status: 'Kapatıldı', priority: 'Yüksek' },
];

const DeviationModule = () => {
  const { toast } = useToast();

  const handleAction = () => {
    toast({
      title: "🚧 Özellik Henüz Geliştirilmedi!",
      description: "Ama endişelenmeyin! Bir sonraki isteğinizde bu özelliği talep edebilirsiniz! 🚀",
    });
  };

  const getStatusColor = (status) => {
    if (status === 'Onaylandı' || status === 'Kapatıldı') return 'bg-green-100 text-green-800';
    if (status === 'Beklemede') return 'bg-yellow-100 text-yellow-800';
    if (status === 'Reddedildi') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };
  
  const getPriorityColor = (priority) => {
    if (priority === 'Yüksek') return 'bg-red-100 text-red-800';
    if (priority === 'Orta') return 'bg-yellow-100 text-yellow-800';
    if (priority === 'Düşük') return 'bg-green-100 text-green-800';
    return 'bg-gray-100 text-gray-800';
  };
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Sapma Onayı Yönetimi</h1>
          <p className="text-white/80 mt-1">Standart dışı işlemler için onay süreçlerinizi yönetin.</p>
        </div>
        <div className="mt-4 sm:mt-0">
           <button onClick={handleAction} className="btn-primary">Yeni Sapma Talebi</button>
        </div>
      </div>

      <div className="dashboard-widget">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Sapma No</th>
                <th>Başlık</th>
                <th>Durum</th>
                <th>Öncelik</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {deviationData.map((item, index) => (
                <motion.tr
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <td className="font-medium text-white">{item.no}</td>
                  <td className="text-white">{item.title}</td>
                  <td><span className={`status-indicator ${getStatusColor(item.status)}`}>{item.status}</span></td>
                  <td><span className={`status-indicator ${getPriorityColor(item.priority)}`}>{item.priority}</span></td>
                  <td><button onClick={handleAction} className="action-button view">Detaylar</button></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DeviationModule;