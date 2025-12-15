import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, BarChart2, DollarSign, Archive, FileText, Users, Settings, Truck, HardHat, Package, FlaskConical, BookOpen, ShieldCheck, GitBranch, ClipboardList, Bot, FileSignature, ScrollText, X, AlertCircle, GraduationCap, TrendingUp, AlertTriangle, Wrench, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { id: 'dashboard', icon: Home, label: 'Ana Panel' },
  { id: 'kpi', icon: BarChart2, label: 'KPI Modülü' },
  { id: 'kaizen', icon: Bot, label: 'İyileştirme (Kaizen)' },
  { id: 'df-8d', icon: FileText, label: 'DF ve 8D Yönetimi' },
  { id: 'quality-cost', icon: DollarSign, label: 'Kalitesizlik Maliyetleri' },
  { id: 'supplier-quality', icon: Users, label: 'Tedarikçi Kalite' },
  { id: 'customer-complaints', icon: AlertCircle, label: 'Müşteri Şikayetleri' },
  { 
    id: 'incoming-quality', 
    icon: Package, 
    label: 'Girdi Kalite Kontrol',
    subItems: [
      { id: 'process-control', icon: Wrench, label: 'Proses Kontrol Yönetimi' }
    ]
  },
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
  { id: 'audit-logs', icon: ScrollText, label: 'Denetim Kayıtları' },
  { id: 'settings', icon: Settings, label: 'Ayarlar' },
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
  const [expandedItems, setExpandedItems] = useState({ 'incoming-quality': true }); // Varsayılan olarak açık
  
  const handleSignOut = async () => {
    await signOut();
  };

  const toggleExpanded = (itemId) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const handleItemClick = (itemId) => {
    setActiveModule(itemId);
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const isItemActive = (item) => {
    if (item.id === activeModule) return true;
    if (item.subItems) {
      return item.subItems.some(subItem => subItem.id === activeModule);
    }
    return false;
  };

  // Aktif modül değiştiğinde ilgili alt menüleri otomatik aç
  useEffect(() => {
    navItems.forEach(item => {
      if (item.subItems && item.subItems.some(subItem => subItem.id === activeModule)) {
        setExpandedItems(prev => ({
          ...prev,
          [item.id]: true
        }));
      }
    });
  }, [activeModule]);

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
            {navItems.filter(item => permittedModules.includes(item.id) || (item.subItems && item.subItems.some(subItem => permittedModules.includes(subItem.id)))).map(item => {
              const hasSubItems = item.subItems && item.subItems.length > 0;
              const isExpanded = expandedItems[item.id];
              const isActive = isItemActive(item);
              const hasActiveSubItem = hasSubItems && item.subItems.some(subItem => subItem.id === activeModule);

              return (
                <div key={item.id}>
                  <motion.button
                    onClick={() => {
                      if (hasSubItems) {
                        // Alt menü varsa hem modülü aç hem alt menüyü göster
                        handleItemClick(item.id);
                        if (!expandedItems[item.id]) {
                          toggleExpanded(item.id);
                        }
                      } else {
                        handleItemClick(item.id);
                      }
                    }}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-lg text-sm font-medium transition-colors",
                      isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground'
                    )}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center flex-1">
                      <item.icon className="mr-3 h-5 w-5" />
                      {item.label}
                    </div>
                    {hasSubItems && (
                      <motion.div
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </motion.div>
                    )}
                  </motion.button>
                  {hasSubItems && (
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="pl-8 pt-1 space-y-1">
                            {item.subItems.filter(subItem => permittedModules.includes(subItem.id)).map(subItem => (
                              <motion.button
                                key={subItem.id}
                                onClick={() => handleItemClick(subItem.id)}
                                className={cn(
                                  "w-full flex items-center p-2 rounded-lg text-sm transition-colors",
                                  activeModule === subItem.id
                                    ? 'bg-primary/20 text-primary-foreground font-medium'
                                    : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground'
                                )}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                              >
                                <subItem.icon className="mr-2 h-4 w-4" />
                                {subItem.label}
                              </motion.button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}
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
        </div>;
};
export default Sidebar;