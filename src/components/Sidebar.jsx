import React from 'react';
import { motion } from 'framer-motion';
import { Home, BarChart2, DollarSign, Archive, FileText, Users, Settings, Truck, HardHat, Package, FlaskConical, BookOpen, ShieldCheck, GitBranch, ClipboardList, Bot, FileSignature, ScrollText, X, AlertCircle, GraduationCap, TrendingUp, BarChart3, FileCheck, AlertTriangle, Factory, CheckSquare } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
const navItems = [
  { id: 'dashboard', icon: Home, label: 'Ana Panel' },
  { id: 'kpi', icon: BarChart2, label: 'KPI Modülü' },
  { id: 'kaizen', icon: Bot, label: 'İyileştirme (Kaizen)' },
  { id: 'df-8d', icon: FileText, label: 'DF ve 8D Yönetimi' },
  { id: 'quality-cost', icon: DollarSign, label: 'Kalitesizlik Maliyetleri' },
  { id: 'supplier-quality', icon: Users, label: 'Tedarikçi Kalite' },
  { id: 'customer-complaints', icon: AlertCircle, label: 'Müşteri Şikayetleri' },
  { id: 'spc', icon: BarChart3, label: 'SPC (İstatistiksel Kontrol)' },
  { id: 'ppap', icon: FileCheck, label: 'PPAP/APQP' },
  { id: 'fmea', icon: AlertTriangle, label: 'FMEA Yönetimi' },
  { id: 'mpc', icon: Factory, label: 'Üretim Planlama' },
  { id: 'process-validation', icon: CheckSquare, label: 'Proses Validasyonu' },
  { id: 'incoming-quality', icon: Package, label: 'Girdi Kalite Kontrol' },
  { id: 'produced-vehicles', icon: Truck, label: 'Üretilen Araçlar' },
  { id: 'internal-audit', icon: HardHat, label: 'İç Tetkik Yönetimi' },
  { id: 'deviation', icon: GitBranch, label: 'Sapma Yönetimi' },
  { id: 'equipment', icon: FlaskConical, label: 'Ekipman & Kalibrasyon' },
  { id: 'quarantine', icon: Archive, label: 'Karantina Yönetimi' },
  { id: 'training', icon: ShieldCheck, label: 'Eğitim Yönetimi' },
  { id: 'polyvalence', icon: GraduationCap, label: 'Polivalans Matrisi' },
  { id: 'benchmark', icon: TrendingUp, label: 'Benchmark Yönetimi' },
  { id: 'document', icon: BookOpen, label: 'Doküman Yönetimi' },
  { id: 'wps', icon: FileSignature, label: 'WPS Yönetimi' },
  { id: 'tasks', icon: ClipboardList, label: 'Görev Yönetimi' },
  { id: 'settings', icon: Settings, label: 'Ayarlar' },
  { id: 'audit-logs', icon: ScrollText, label: 'Denetim Kayıtları' },
];
const Sidebar = ({
  activeModule,
  setActiveModule,
  permittedModules,
  setSidebarOpen
}) => {
  const {
    user,
    signOut
  } = useAuth();
  const handleSignOut = async () => {
    await signOut();
  };
  return <div className="flex flex-col h-full bg-card text-card-foreground border-r border-border">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-10 w-10 text-primary" />
              <div>
                <h1 className="text-lg font-bold leading-tight">Kademe A.Ş.</h1>
                <p className="text-xs text-muted-foreground">Kalite Yönetim Sistemi</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
              <span className="sr-only">Menüyü kapat</span>
            </Button>
          </div>
          <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
            {navItems.filter(item => permittedModules.includes(item.id)).map(item => <motion.button key={item.id} onClick={() => {
        setActiveModule(item.id);
        if (window.innerWidth < 1024) {
          setSidebarOpen(false);
        }
      }} className={`w-full flex items-center p-3 rounded-lg text-sm font-medium transition-colors ${activeModule === item.id ? 'bg-primary text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground'}`} whileHover={{
        scale: 1.03
      }} whileTap={{
        scale: 0.98
      }}>
                <item.icon className="mr-3 h-5 w-5" />
                {item.label}
              </motion.button>)}
          </nav>
          <div className="p-4 border-t border-border">
            <div className="text-sm mb-2">
              <p className="font-semibold">{user?.user_metadata?.full_name || 'Kullanıcı'}</p>
              <p className="text-muted-foreground">{user?.email}</p>
            </div>
            <Button onClick={handleSignOut} variant="outline" className="w-full">
              Çıkış Yap
            </Button>
          </div>
        </div>;
};
export default Sidebar;