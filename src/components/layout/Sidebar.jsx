import React from 'react';
import { motion } from 'framer-motion';
import { Home, BarChart2, DollarSign, Archive, FileText, Users, Settings, Truck, HardHat, Package, FlaskConical, BookOpen, ShieldCheck, GitBranch, ClipboardList, Bot, FileSignature, ScrollText, X, AlertCircle, GraduationCap, TrendingUp, Wrench, LogOut, User, RotateCcw } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

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
      { id: 'nonconformity', icon: ClipboardList, label: 'Uygunsuzluk Yönetimi' },
      { id: 'df-8d', icon: FileText, label: 'DF ve 8D Yönetimi' },
      { id: 'quality-cost', icon: DollarSign, label: 'Kalite Maliyetleri' },
      { id: 'customer-complaints', icon: AlertCircle, label: 'Müşteri Şikayetleri' },
    ]
  },
  {
    label: 'Girdi ve Üretim Kalite',
    items: [
      { id: 'incoming-quality', icon: Package, label: 'Girdi Kalite Kontrol' },
      { id: 'process-control', icon: Wrench, label: 'Proses Kontrol Yönetimi' },
      { id: 'produced-vehicles', icon: Truck, label: 'Üretilen Araçlar' },
      { id: 'dynamic-balance', icon: RotateCcw, label: 'Dinamik Balans Kontrol' },
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
  setSidebarOpen,
  moduleTitles
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
      {/* Header - Mobil için güvenli alan */}
      <div className="flex flex-col gap-2 p-3 sm:p-4 border-b border-border shrink-0" style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <ShieldCheck className="h-8 w-8 sm:h-10 sm:w-10 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-lg font-bold leading-tight truncate">Kademe A.Ş.</h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Kalite Yönetim Sistemi</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden h-9 w-9 shrink-0" 
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Menüyü kapat</span>
          </Button>
        </div>
        {/* Aktif Modül Göstergesi */}
        {activeModule && moduleTitles?.[activeModule] && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-primary/5 border border-primary/10">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse shrink-0"></div>
            <p className="text-xs sm:text-sm font-semibold text-primary truncate flex-1">
              {moduleTitles[activeModule]}
            </p>
          </div>
        )}
      </div>
      
      {/* Navigation - Scrollable */}
      <ScrollArea className="flex-1">
        <nav className="p-2 space-y-1">
          {navGroups.map((group, groupIndex) => {
            // Grubun içinde izinli modüller var mı kontrol et
            const hasPermittedItems = group.items.some(item => permittedModules.includes(item.id));
            
            if (!hasPermittedItems) return null;

            return (
              <div key={group.label}>
                {groupIndex > 0 && <Separator className="my-2" />}
                <div className="px-2 py-1.5">
                  <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {group.label}
                  </p>
                </div>
                <div className="space-y-0.5">
                  {group.items
                    .filter(item => permittedModules.includes(item.id))
                    .map(item => (
                      <motion.button
                        key={item.id}
                        onClick={() => handleItemClick(item.id)}
                        className={`w-full flex items-center p-2.5 sm:p-3 rounded-lg text-xs sm:text-sm font-medium transition-colors touch-manipulation ${
                          activeModule === item.id
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-accent hover:text-accent-foreground active:bg-accent'
                        }`}
                        whileTap={{ scale: 0.98 }}
                      >
                        <item.icon className="mr-2 sm:mr-3 h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </motion.button>
                    ))}
                </div>
              </div>
            );
          })}
        </nav>
      </ScrollArea>
      
      {/* User Info - Mobil için güvenli alan */}
      <div className="p-3 sm:p-4 border-t border-border shrink-0" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}>
        <div className="flex items-center gap-2 mb-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div className="text-xs sm:text-sm min-w-0 flex-1">
            <p className="font-semibold truncate">{user?.user_metadata?.full_name || 'Kullanıcı'}</p>
            <p className="text-muted-foreground truncate text-[10px] sm:text-xs">{user?.email}</p>
          </div>
        </div>
        <Button onClick={handleSignOut} variant="outline" className="w-full h-9 sm:h-10 text-xs sm:text-sm">
          <LogOut className="h-4 w-4 mr-2" />
          Çıkış Yap
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;
