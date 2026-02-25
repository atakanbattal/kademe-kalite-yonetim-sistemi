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
} from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const SUPER_ADMIN_EMAIL = 'atakan.battal@kademe.com.tr';

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

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5" /> Yetki Düzenle — {user.full_name || user.email}
          </DialogTitle>
          <DialogDescription>Modül bazında erişim yetkilerini ayarlayın.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {Object.entries(PERMISSION_TEMPLATES).map(([key, t]) => (
              <Button key={key} variant="outline" size="sm" onClick={() => applyTemplate(key)}>
                {t.label} Uygula
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {ALL_MODULES.map((module) => (
              <div key={module} className="space-y-1.5 p-3 rounded-lg border bg-muted/30" data-testid={`perm-module-${module}`}>
                <Label className="text-xs font-medium">{moduleLabels[module]}</Label>
                <Select
                  value={localPerms[module] || 'none'}
                  onValueChange={(v) => setLocalPerms((p) => ({ ...p, [module]: v }))}
                >
                  <SelectTrigger className="h-8" data-testid={`perm-select-${module}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none"><ShieldOff className="w-3.5 h-3.5 mr-2 text-muted-foreground" /> Erişim Yok</SelectItem>
                    <SelectItem value="read"><Eye className="w-3.5 h-3.5 mr-2 text-blue-500" /> Sadece Okuma</SelectItem>
                    <SelectItem value="full"><Shield className="w-3.5 h-3.5 mr-2 text-green-500" /> Tam Erişim</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
          <Button onClick={handleSave} disabled={isSaving} data-testid="perm-save-btn">{isSaving ? 'Kaydediliyor...' : 'Kaydet'}</Button>
        </DialogFooter>
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

    const { error } = await supabase.functions.invoke('manage-user', {
      body: { action: 'update_password', userId: user.id, payload: { newPassword } },
    });

    if (error) {
      const msg = error.message?.includes('FunctionsRelay') || error.message?.includes('fetch')
        ? 'manage-user Edge Function erişilemedi. Deploy edin: npm run supabase:deploy-functions'
        : error.message;
      toast({ variant: 'destructive', title: 'Hata', description: msg });
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
    const { error } = await supabase.functions.invoke('manage-user', {
      body: {
        action: 'update_permissions',
        userId,
        payload: { permissions: permissionsToSave, user_metadata: user?.raw_user_meta_data },
      },
    });

    if (error) {
      const msg = error.message?.includes('FunctionsRelay') || error.message?.includes('fetch')
        ? 'manage-user Edge Function erişilemedi. Deploy edin: npm run supabase:deploy-functions'
        : error.message;
      toast({ variant: 'destructive', title: 'Hata', description: msg });
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

    const { error } = await supabase.functions.invoke('manage-user', {
      body: { action: 'delete_user', userId, payload: { email: user?.email } },
    });

    if (error) {
      const msg = error.message?.includes('FunctionsRelay') || error.message?.includes('fetch')
        ? 'manage-user Edge Function erişilemedi. Deploy edin: npm run supabase:deploy-functions'
        : error.message;
      toast({ variant: 'destructive', title: 'Hata', description: msg });
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="İsim veya e-posta ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
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
