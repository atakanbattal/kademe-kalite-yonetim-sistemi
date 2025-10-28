import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Clock, FileText, GitPullRequest, HardHat, List, Package, ShieldAlert, Users } from 'lucide-react';

const kpiData = [
  { title: 'Açık DÖF Sayısı', value: 8, icon: FileText, color: 'text-yellow-400' },
  { title: 'Açık DF/8D Raporu', value: 3, icon: GitPullRequest, color: 'text-yellow-400' },
  { title: 'Bekleyen Tetkik Aksiyonları', value: 12, icon: Clock, color: 'text-orange-400' },
  { title: 'Karantinadaki Ürün Sayısı', value: 25, icon: Package, color: 'text-red-400' },
  { title: 'Tedarikçi Uygunsuzluk Oranı', value: '2.1%', icon: Users, color: 'text-red-400' },
  { title: 'Genel Kalite Performansı', value: 'İyi', icon: CheckCircle, color: 'text-green-400' },
];

const recentDocs = [
  { name: 'PRO-001 Rev.02', date: '2025-08-28' },
  { name: 'TAL-015 Rev.00', date: '2025-08-25' },
  { name: 'FRM-042 Rev.01', date: '2025-08-22' },
];

const pendingApprovals = [
  { name: 'DF-2025-034', user: 'Ahmet Yılmaz' },
  { name: 'Sapma-007', user: 'Ayşe Kaya' },
  { name: 'PRO-002 Rev.01', user: 'Mehmet Öztürk' },
];

const upcomingCalibrations = [
    { name: 'Kumpas-012', dueDate: '2025-09-15' },
    { name: 'Mikrometre-005', dueDate: '2025-09-20' },
    { name: 'Torkmetre-008', dueDate: '2025-09-22' },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 100,
    },
  },
};

const Dashboard = () => {
  return (
    <>
      <Helmet>
        <title>Dashboard - Kademe Kalite Yönetimi</title>
        <meta name="description" content="Kademe A.Ş. Kalite Yönetim Sistemi genel bakış ve KPI göstergeleri." />
      </Helmet>
      <div className="space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
          <p className="text-gray-400">Kalite süreçlerinize genel bir bakış.</p>
        </motion.div>

        <motion.div
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {kpiData.map((kpi, index) => (
            <motion.div key={index} variants={itemVariants}>
              <Card className="bg-gray-800/50 border-gray-700 hover:bg-gray-800/80 transition-colors duration-300 transform hover:-translate-y-1">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-300">{kpi.title}</CardTitle>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${kpi.color}`}>{kpi.value}</div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          className="grid gap-8 md:grid-cols-1 lg:grid-cols-3"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="lg:col-span-1">
            <Card className="h-full bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center"><List className="mr-2 h-5 w-5 text-purple-400" />Kalibrasyonu Yaklaşanlar</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {upcomingCalibrations.map((item, index) => (
                    <li key={index} className="flex justify-between items-center text-sm p-2 rounded-md bg-gray-700/30">
                      <span className="font-medium text-gray-200">{item.name}</span>
                      <span className="text-yellow-400">{item.dueDate}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={itemVariants} className="lg:col-span-1">
            <Card className="h-full bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center"><FileText className="mr-2 h-5 w-5 text-purple-400" />Son Eklenen Dokümanlar</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {recentDocs.map((doc, index) => (
                    <li key={index} className="flex justify-between items-center text-sm p-2 rounded-md bg-gray-700/30">
                      <span className="font-medium text-gray-200">{doc.name}</span>
                      <span className="text-gray-400">{doc.date}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={itemVariants} className="lg:col-span-1">
            <Card className="h-full bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center"><ShieldAlert className="mr-2 h-5 w-5 text-purple-400" />Bekleyen Onaylar</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {pendingApprovals.map((approval, index) => (
                    <li key={index} className="flex justify-between items-center text-sm p-2 rounded-md bg-gray-700/30">
                      <span className="font-medium text-gray-200">{approval.name}</span>
                      <span className="text-gray-400">{approval.user}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </>
  );
};

export default Dashboard;