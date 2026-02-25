import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Search,
  Plus,
  MoreHorizontal,
  Pencil,
  KeyRound,
  Trash2,
  Shield,
  Eye,
  ShieldOff,
  UserPlus,
  LayoutDashboard,
  BarChart3,
  AlertTriangle,
  FileWarning,
  DollarSign,
  MessageSquare,
  PackageCheck,
  Gauge,
  Car,
  Activity,
  Factory,
  ClipboardCheck,
  SearchCheck,
  FileText,
  BookOpen,
  Wrench,
  FileCog,
  Lightbulb,
  GraduationCap,
  Users,
  TrendingUp,
  ShieldAlert,
  ListTodo,
  Settings,
  Lock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const SUPER_ADMIN_EMAIL = 'atakan.battal@kademe.com.tr';

async function invokeManageUser(body) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Oturum bulunamadı. Lütfen tekrar giriş yapın.');

  const res = await fetch('/api/manage-user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Sunucu beklenmedik yanıt döndü (HTTP ${res.status})`);
  }

  if (!res.ok) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  return json;
}

const ALL_MODULES = [
  'dashboard', 'kpi', 'nonconformity', 'df-8d', 'quality-cost', 'customer-complaints',
  'incoming-quality', 'process-control', 'produced-vehicles', 'dynamic-balance',
  'supplier-quality', 'supplier-audit', 'internal-audit', 'deviation', 'audit-logs',
  'equipment', 'document', 'wps', 'kaizen', 'training', 'polyvalence', 'benchmark',
  'quarantine', 'tasks', 'settings',
];

const moduleLabels = {
  dashboard: 'Ana Panel', kpi: 'KPI', nonconformity: 'Uygunsuzluk', 'df-8d': 'DF/8D',
  'quality-cost': 'Kalite Maliyetleri', 'customer-complaints': 'Müşteri Şikayetleri',
  'incoming-quality': 'Girdi Kalite', 'process-control': 'Proses Kontrol',
  'produced-vehicles': 'Üretilen Araçlar', 'dynamic-balance': 'Dinamik Balans',
  'supplier-quality': 'Tedarikçi Kalite', 'supplier-audit': 'Tedarikçi Denetimi',
  'internal-audit': 'İç Tetkik', deviation: 'Sapma', 'audit-logs': 'Denetim Kayıtları',
  equipment: 'Ekipman', document: 'Doküman', wps: 'WPS', kaizen: 'Kaizen',
  training: 'Eğitim', polyvalence: 'Polivalans', benchmark: 'Benchmark',
  quarantine: 'Karantina', tasks: 'Görevler', settings: 'Ayarlar',
};

const PERMISSION_TEMPLATES = {
  admin: { label: 'Yönetici', permissions: Object.fromEntries(ALL_MODULES.map((m) => [m, 'full'])) },
  viewer: { label: 'Görüntüleyici', permissions: Object.fromEntries(ALL_MODULES.map((m) => [m, 'read'])) },
  operator: {
    label: 'Operatör',
    permissions: {
      dashboard: 'read', kpi: 'read', nonconformity: 'full', 'df-8d': 'full', 'quality-cost': 'read',
      'customer-complaints': 'full', 'incoming-quality': 'full', 'process-control': 'read',
      'produced-vehicles': 'full', 'dynamic-balance': 'full', 'supplier-quality': 'read',
      'supplier-audit': 'read', 'internal-audit': 'read', deviation: 'full', 'audit-logs': 'none',
      equipment: 'read', document: 'read', wps: 'read', kaizen: 'full', training: 'read',
      polyvalence: 'read', benchmark: 'read', quarantine: 'full', tasks: 'full', settings: 'none',
    },
  },
};

const NewUserModal = ({ open, setOpen, onUserAdded }) => {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password || !fullName) {
      toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Tüm alanlar zorunludur.' });
      return;
    }
    if (password.length < 6) {
      toast({ variant: 'destructive', title: 'Geçersiz Şifre', description: 'Şifre en az 6 karakter olmalıdır.' });
      return;
    }
    setIsSubmitting(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, permissions: {} } },
    });

    if (error) {
      toast({ variant: 'destructive', title: 'Hata', description: error.message });
    } else if (data.user) {
      await supabase.from('profiles').update({ full_name: fullName, permissions: {} }).eq('id', data.user.id);
      toast({ title: 'Başarılı', description: 'Yeni kullanıcı oluşturuldu.' });
      setEmail('');
      setPassword('');
      setFullName('');
      onUserAdded();
      setOpen(false);
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" /> Yeni Hesap Oluştur
          </DialogTitle>
          <DialogDescription>Yeni bir kullanıcı hesabı oluşturun. E-posta ve şifre ile giriş yapabilecek.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Ad Soyad</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Örn: Ahmet Yılmaz" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-posta</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@firma.com" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Şifre</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="En az 6 karakter" minLength={6} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>İptal</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Oluşturuluyor...' : 'Hesap Oluştur'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const MODULE_ICONS = {
  dashboard: LayoutDashboard, kpi: BarChart3, nonconformity: AlertTriangle,
  'df-8d': FileWarning, 'quality-cost': DollarSign, 'customer-complaints': MessageSquare,
  'incoming-quality': PackageCheck, 'process-control': Gauge, 'produced-vehicles': Car,
  'dynamic-balance': Activity, 'supplier-quality': Factory, 'supplier-audit': ClipboardCheck,
  'internal-audit': SearchCheck, deviation: FileText, 'audit-logs': BookOpen,
  equipment: Wrench, document: FileCog, wps: FileText, kaizen: Lightbulb,
  training: GraduationCap, polyvalence: Users, benchmark: TrendingUp,
  quarantine: ShieldAlert, tasks: ListTodo, settings: Settings,
};

const MODULE_GROUPS = [
  { title: 'Genel', modules: ['dashboard', 'kpi', 'tasks', 'settings'] },
  { title: 'Kalite Yönetimi', modules: ['nonconformity', 'df-8d', 'customer-complaints', 'deviation', 'quarantine'] },
  { title: 'Üretim & Kontrol', modules: ['incoming-quality', 'process-control', 'produced-vehicles', 'dynamic-balance'] },
  { title: 'Tedarikçi', modules: ['supplier-quality', 'supplier-audit'] },
  { title: 'Denetim & Kayıtlar', modules: ['internal-audit', 'audit-logs'] },
  { title: 'Doküman & Ekipman', modules: ['equipment', 'document', 'wps'] },
  { title: 'İyileştirme & Eğitim', modules: ['kaizen', 'training', 'polyvalence', 'benchmark'] },
  { title: 'Maliyet', modules: ['quality-cost'] },
];

const PermissionToggle = ({ value, onChange, testId }) => {
  const options = [
    { key: 'none', label: 'Yok', icon: XCircle, color: 'text-gray-400', activeBg: 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300' },
    { key: 'read', label: 'Okuma', icon: Eye, color: 'text-blue-500', activeBg: 'bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300' },
    { key: 'full', label: 'Tam', icon: CheckCircle2, color: 'text-green-500', activeBg: 'bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300' },
  ];
  return (
    <div className="flex flex-nowrap gap-1 shrink-0" data-testid={testId}>
      {options.map((opt) => {
        const Icon = opt.icon;
        const isActive = (value || 'none') === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all duration-150 whitespace-nowrap shrink-0 ${
              isActive
                ? opt.activeBg + ' shadow-sm'
                : 'bg-transparent border-transparent text-muted-foreground hover:bg-muted/50'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? opt.color : 'text-muted-foreground/60'}`} />
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};

const EditPermissionsModal = ({ open, setOpen, user, permissions, onSave }) => {
  const [localPerms, setLocalPerms] = useState(permissions || {});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalPerms(permissions || {});
  }, [permissions, open]);

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(user.id, localPerms);
    setIsSaving(false);
    setOpen(false);
  };

  const applyTemplate = (key) => {
    setLocalPerms(PERMISSION_TEMPLATES[key].permissions);
  };

  const permStats = useMemo(() => {
    let full = 0, read = 0, none = 0;
    ALL_MODULES.forEach((m) => {
      const v = localPerms[m] || 'none';
      if (v === 'full') full++;
      else if (v === 'read') read++;
      else none++;
    });
    return { full, read, none };
  }, [localPerms]);

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="!inset-0 !translate-x-0 !translate-y-0 !w-full !h-full !max-w-none !max-h-none rounded-none flex flex-col p-0 gap-0 overflow-hidden">
        <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b bg-gradient-to-r from-slate-50 to-blue-50/50 dark:from-slate-900 dark:to-blue-950/30">
          <DialogHeader className="space-y-3 pr-10">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <DialogTitle className="flex items-center gap-3 text-lg">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900 flex-shrink-0">
                  <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0">
                  <div>Yetki Düzenle</div>
                  <div className="text-sm font-normal text-muted-foreground truncate">{user.full_name || user.email}</div>
                </div>
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 shrink-0">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> {permStats.full} Tam
                </Badge>
                <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 shrink-0">
                  <Eye className="w-3 h-3 mr-1" /> {permStats.read} Okuma
                </Badge>
                <Badge variant="outline" className="bg-gray-50 dark:bg-gray-900 text-gray-500 border-gray-200 dark:border-gray-700 shrink-0">
                  <ShieldOff className="w-3 h-3 mr-1" /> {permStats.none} Yok
                </Badge>
              </div>
            </div>
            <DialogDescription className="sr-only">Modül bazında erişim yetkilerini ayarlayın.</DialogDescription>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">Hızlı şablon:</span>
              {Object.entries(PERMISSION_TEMPLATES).map(([key, t]) => (
                <Button key={key} variant="outline" size="sm" className="h-8 text-xs shrink-0" onClick={() => applyTemplate(key)}>
                  {key === 'admin' && <Shield className="w-3 h-3 mr-1 text-green-500 shrink-0" />}
                  {key === 'viewer' && <Eye className="w-3 h-3 mr-1 text-blue-500 shrink-0" />}
                  {key === 'operator' && <Wrench className="w-3 h-3 mr-1 text-orange-500 shrink-0" />}
                  {t.label}
                </Button>
              ))}
            </div>
          </DialogHeader>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-5">
          {MODULE_GROUPS.map((group) => (
            <div key={group.title}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5 flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span>{group.title}</span>
                <div className="h-px flex-1 bg-border" />
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {group.modules.map((module) => {
                  const Icon = MODULE_ICONS[module] || Shield;
                  const val = localPerms[module] || 'none';
                  return (
                    <div
                      key={module}
                      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg border transition-colors ${
                        val === 'full' ? 'border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/20' :
                        val === 'read' ? 'border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/20' :
                        'border-border bg-muted/20'
                      }`}
                      data-testid={`perm-module-${module}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 shrink-0">
                        <Icon className={`w-4 h-4 flex-shrink-0 ${
                          val === 'full' ? 'text-green-500' :
                          val === 'read' ? 'text-blue-500' :
                          'text-muted-foreground/50'
                        }`} />
                        <span className="text-sm font-medium truncate">{moduleLabels[module]}</span>
                      </div>
                      <PermissionToggle
                        value={val}
                        onChange={(v) => setLocalPerms((p) => ({ ...p, [module]: v }))}
                        testId={`perm-select-${module}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex-shrink-0 px-6 py-4 border-t bg-muted/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-muted-foreground order-2 sm:order-1">Toplam {ALL_MODULES.length} modül</p>
          <div className="flex items-center gap-2 order-1 sm:order-2 shrink-0">
            <Button variant="outline" onClick={() => setOpen(false)} className="min-w-[80px]">İptal</Button>
            <Button onClick={handleSave} disabled={isSaving} data-testid="perm-save-btn" className="min-w-[140px]">
              {isSaving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                  Kaydediliyor...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Lock className="w-4 h-4 shrink-0" />
                  Yetkileri Kaydet
                </span>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const ChangePasswordModal = ({ open, setOpen, user, onSuccess }) => {
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast({ variant: 'destructive', title: 'Hata', description: 'Şifre en az 6 karakter olmalıdır.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ variant: 'destructive', title: 'Hata', description: 'Şifreler eşleşmiyor.' });
      return;
    }
    setIsSubmitting(true);

    let error = null;
    try {
      await invokeManageUser({ action: 'update_password', userId: user.id, payload: { newPassword } });
    } catch (e) {
      error = e;
    }

    if (error) {
      toast({ variant: 'destructive', title: 'Hata', description: error.message });
    } else {
      toast({ title: 'Başarılı', description: 'Şifre güncellendi.' });
      setOpen(false);
      onSuccess?.();
    }
    setIsSubmitting(false);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5" /> Şifre Değiştir
          </DialogTitle>
          <DialogDescription>
            {user.full_name || user.email} için yeni şifre belirleyin.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPass">Yeni Şifre</Label>
            <Input id="newPass" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="En az 6 karakter" minLength={6} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPass">Şifre Tekrar</Label>
            <Input id="confirmPass" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Şifreyi tekrar girin" required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>İptal</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const AccountManager = () => {
  const { toast } = useToast();
  const { logAudit } = useData();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [userPermissions, setUserPermissions] = useState({});
  const [isNewUserOpen, setNewUserOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [passwordUser, setPasswordUser] = useState(null);
  const [deleteTargetUser, setDeleteTargetUser] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_all_users_with_profiles');
    if (error) {
      const msg = error.code === '42883' || error.message?.includes('function')
        ? 'get_all_users_with_profiles RPC bulunamadı. Supabase migration çalıştırın: supabase db push'
        : error.message || 'Kullanıcılar yüklenemedi.';
      toast({ variant: 'destructive', title: 'Hata', description: msg });
    } else {
      setUsers(data || []);
      const perms = (data || []).reduce((acc, u) => {
        acc[u.id] = u.permissions || u.raw_user_meta_data?.permissions || {};
        return acc;
      }, {});
      setUserPermissions(perms);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const getPermissionSummary = (perms) => {
    const p = perms || {};
    let full = 0, read = 0, none = 0;
    ALL_MODULES.forEach((m) => {
      const v = p[m] || 'none';
      if (v === 'full') full++;
      else if (v === 'read') read++;
      else none++;
    });
    return { full, read, none };
  };

  const savePermissions = async (userId, permissionsToSave) => {
    const user = users.find((u) => u.id === userId);
    let error = null;
    let result = null;
    try {
      result = await invokeManageUser({
        action: 'update_permissions',
        userId,
        payload: { permissions: permissionsToSave, user_metadata: user?.raw_user_meta_data },
      });
      console.log('savePermissions result:', result);
    } catch (e) {
      error = e;
      console.error('savePermissions error:', e);
    }

    if (error) {
      toast({ variant: 'destructive', title: 'Hata', description: error.message });
    } else {
      setUserPermissions((prev) => ({ ...prev, [userId]: permissionsToSave }));
      toast({ title: 'Başarılı', description: 'Yetkiler kaydedildi.' });
      logAudit('İzin Güncelleme', { userId, newPermissions: permissionsToSave }, 'profiles');
      await fetchUsers();
    }
  };

  const deleteUser = async (userId) => {
    const user = users.find((u) => u.id === userId);
    if (user?.email === SUPER_ADMIN_EMAIL) {
      toast({ variant: 'destructive', title: 'İşlem Reddedildi', description: 'Ana admin hesabı silinemez.' });
      return false;
    }

    let error = null;
    try {
      await invokeManageUser({ action: 'delete_user', userId, payload: { email: user?.email } });
    } catch (e) {
      error = e;
    }

    if (error) {
      toast({ variant: 'destructive', title: 'Hata', description: error.message });
      return false;
    }
    toast({ title: 'Başarılı', description: 'Hesap silindi.' });
    logAudit('Kullanıcı Silme', { userId }, 'auth.users');
    fetchUsers();
    return true;
  };

  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return users;
    const t = searchTerm.toLowerCase();
    return users.filter(
      (u) =>
        (u.full_name || '').toLowerCase().includes(t) ||
        (u.email || '').toLowerCase().includes(t)
    );
  }, [users, searchTerm]);

  const handleEditSave = async (userId, perms) => {
    await savePermissions(userId, perms);
    setEditUser(null);
  };

  return (
    <TooltipProvider>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <NewUserModal open={isNewUserOpen} setOpen={setNewUserOpen} onUserAdded={fetchUsers} />
        <EditPermissionsModal
          open={!!editUser}
          setOpen={(v) => !v && setEditUser(null)}
          user={editUser}
          permissions={editUser ? userPermissions[editUser.id] : {}}
          onSave={handleEditSave}
        />
        <ChangePasswordModal
          open={!!passwordUser}
          setOpen={(v) => !v && setPasswordUser(null)}
          user={passwordUser}
          onSuccess={() => setPasswordUser(null)}
        />
        <AlertDialog open={!!deleteTargetUser} onOpenChange={(v) => !v && setDeleteTargetUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hesabı Sil</AlertDialogTitle>
              <AlertDialogDescription>
                "{deleteTargetUser?.full_name || deleteTargetUser?.email}" hesabı kalıcı olarak silinecek. Bu işlem geri alınamaz.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>İptal</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (deleteTargetUser) {
                    const ok = await deleteUser(deleteTargetUser.id);
                    if (ok) setDeleteTargetUser(null);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Sil
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Hesap Yönetimi</h2>
            <p className="text-sm text-muted-foreground">
              Kullanıcı hesaplarını oluşturun, yetkileri düzenleyin ve şifreleri yönetin.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none shrink-0" />
              <Input
                placeholder="İsim veya e-posta ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="!pl-10"
              />
            </div>
            <Button onClick={() => setNewUserOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Yeni Hesap
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          {loading ? (
            <div className="py-16 text-center text-muted-foreground">Yükleniyor...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              {searchTerm ? 'Arama sonucu bulunamadı.' : 'Henüz kullanıcı yok.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kullanıcı</TableHead>
                  <TableHead>E-posta</TableHead>
                  <TableHead>Yetki Özeti</TableHead>
                  <TableHead className="text-right w-[80px]">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const perms = userPermissions[user.id] || {};
                  const summary = getPermissionSummary(perms);
                  const isSuperAdmin = user.email === SUPER_ADMIN_EMAIL;

                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="font-medium">{user.full_name || 'İsimsiz'}</div>
                        {isSuperAdmin && (
                          <Badge variant="outline" className="mt-1 text-xs">Ana Admin</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {summary.full > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Badge variant="secondary" className="text-xs bg-green-500/15 text-green-700 dark:text-green-400">
                                    <Shield className="w-3 h-3 mr-0.5" /> {summary.full}
                                  </Badge>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>Tam yetkili modül sayısı</TooltipContent>
                            </Tooltip>
                          )}
                          {summary.read > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Badge variant="secondary" className="text-xs bg-blue-500/15 text-blue-700 dark:text-blue-400">
                                    <Eye className="w-3 h-3 mr-0.5" /> {summary.read}
                                  </Badge>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>Okuma yetkili modül sayısı</TooltipContent>
                            </Tooltip>
                          )}
                          {summary.none > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Badge variant="outline" className="text-xs text-muted-foreground">
                                    <ShieldOff className="w-3 h-3 mr-0.5" /> {summary.none}
                                  </Badge>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>Erişim yok modül sayısı</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`user-actions-${user.email}`}>
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditUser(user)} disabled={isSuperAdmin}>
                              <Pencil className="w-4 h-4 mr-2" /> Yetkileri Düzenle
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setPasswordUser(user)}>
                              <KeyRound className="w-4 h-4 mr-2" /> Şifre Değiştir
                            </DropdownMenuItem>
                            {!isSuperAdmin && (
                              <DropdownMenuItem onClick={() => setDeleteTargetUser(user)} className="text-destructive focus:text-destructive">
                                <Trash2 className="w-4 h-4 mr-2" /> Hesabı Sil
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </motion.div>
    </TooltipProvider>
  );
};

export default AccountManager;
