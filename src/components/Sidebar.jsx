import React from 'react';
import { motion } from 'framer-motion';
import { Home, BarChart2, DollarSign, Archive, FileText, Users, Settings, Truck, HardHat, Package, FlaskConical, BookOpen, ShieldCheck, GitBranch, ClipboardList, Bot, FileSignature, ScrollText, X, AlertCircle, GraduationCap, TrendingUp, Wrench } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

// Sidebar öğeleri mantıklı gruplara ayrılmış
const navGroups = [
  {
    label: 'Ana Paneller',
    items: [
      { id: 'dashboard', icon: Home, label: 'Ana Panel' },
      { id: 'kpi', icon: BarChart2, label: 'KPI Modülü' },
    ]
  },
  {
    label: 'Kalite Yönetimi',
    items: [
      { id: 'df-8d', icon: FileText, label: 'DF ve 8D Yönetimi' },
      { id: 'quality-cost', icon: DollarSign, label: 'Kalitesizlik Maliyetleri' },
      { id: 'customer-complaints', icon: AlertCircle, label: 'Müşteri Şikayetleri' },
    ]
  },
  {
    label: 'Girdi ve Üretim Kalite',
    items: [
      { id: 'incoming-quality', icon: Package, label: 'Girdi Kalite Kontrol' },
      { id: 'process-control', icon: Wrench, label: 'Proses Kontrol Yönetimi' },
      { id: 'produced-vehicles', icon: Truck, label: 'Üretilen Araçlar' },
    ]
  },
  {
    label: 'Tedarikçi Yönetimi',
    items: [
      { id: 'supplier-quality', icon: Users, label: 'Tedarikçi Kalite' },
    ]
  },
  {
    label: 'Denetim ve Uyumluluk',
    items: [
      { id: 'internal-audit', icon: HardHat, label: 'İç Tetkik Yönetimi' },
      { id: 'deviation', icon: GitBranch, label: 'Sapma Yönetimi' },
      { id: 'audit-logs', icon: ScrollText, label: 'Denetim Kayıtları' },
    ]
  },
  {
    label: 'Ekipman ve Dokümantasyon',
    items: [
      { id: 'equipment', icon: FlaskConical, label: 'Ekipman & Kalibrasyon' },
      { id: 'document', icon: BookOpen, label: 'Doküman Yönetimi' },
      { id: 'wps', icon: FileSignature, label: 'WPS Yönetimi' },
    ]
  },
  {
    label: 'İyileştirme ve Eğitim',
    items: [
      { id: 'kaizen', icon: Bot, label: 'İyileştirme (Kaizen)' },
      { id: 'training', icon: ShieldCheck, label: 'Eğitim Yönetimi' },
      { id: 'polyvalence', icon: GraduationCap, label: 'Polivalans Matrisi' },
      { id: 'benchmark', icon: TrendingUp, label: 'Benchmark Yönetimi' },
    ]
  },
  {
    label: 'Operasyonel',
    items: [
      { id: 'quarantine', icon: Archive, label: 'Karantina Yönetimi' },
      { id: 'tasks', icon: ClipboardList, label: 'Görev Yönetimi' },
    ]
  },
  {
    label: 'Sistem',
    items: [
      { id: 'settings', icon: Settings, label: 'Ayarlar' },
    ]
  },
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

  const handleItemClick = (itemId) => {
    setActiveModule(itemId);
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-card text-card-foreground border-r border-border">
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
      <nav className="flex-1 p-2 space-y-2 overflow-y-auto">
        {navGroups.map((group, groupIndex) => {
          // Grubun içinde izinli modüller var mı kontrol et
          const hasPermittedItems = group.items.some(item => permittedModules.includes(item.id));
          
          if (!hasPermittedItems) return null;

          return (
            <div key={group.label}>
              {groupIndex > 0 && <Separator className="my-2" />}
              <div className="px-2 py-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {group.label}
                </p>
              </div>
              <div className="space-y-1">
                {group.items
                  .filter(item => permittedModules.includes(item.id))
                  .map(item => (
                    <motion.button
                      key={item.id}
                      onClick={() => handleItemClick(item.id)}
                      className={`w-full flex items-center p-3 rounded-lg text-sm font-medium transition-colors ${
                        activeModule === item.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-accent hover:text-accent-foreground'
                      }`}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <item.icon className="mr-3 h-5 w-5" />
                      {item.label}
                    </motion.button>
                  ))}
              </div>
            </div>
          );
        })}
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
    </div>
  );
};

export default Sidebar;
