import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Search, Plus, Save, Trash2, Shield, Eye, ShieldOff } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL_MODULES = [
    'dashboard', 'kpi', 'kaizen', 'df-8d', 'quality-cost', 
    'supplier-quality', 'incoming-quality', 'produced-vehicles', 
    'internal-audit', 'deviation', 'equipment', 'quarantine', 
    'training', 'document', 'wps', 'tasks', 'settings', 'audit-logs'
];

const moduleLabels = {
    dashboard: 'Ana Panel', kpi: 'KPI', kaizen: 'Kaizen', 'df-8d': 'DF/8D', 
    'quality-cost': 'Maliyet', 'supplier-quality': 'Tedarikçi', 'incoming-quality': 'Girdi Kalite',
    'produced-vehicles': 'Üretilen Araçlar', 'internal-audit': 'İç Tetkik', deviation: 'Sapma',
    equipment: 'Ekipman', quarantine: 'Karantina', training: 'Eğitim', document: 'Doküman',
    wps: 'WPS', tasks: 'Görevler', settings: 'Ayarlar', 'audit-logs': 'Denetim Kayıtları'
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
        setIsSubmitting(true);

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    permissions: {} 
                }
            }
        });

        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: `Kullanıcı oluşturulamadı: ${error.message}` });
        } else if (data.user) {
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ full_name: fullName, permissions: {} })
                .eq('id', data.user.id);
            
            if (profileError) {
                 toast({ variant: 'warning', title: 'Profil Güncellenemedi', description: 'Kullanıcı oluşturuldu ancak profil bilgileri güncellenemedi.' });
            } else {
                toast({ title: 'Başarılı', description: 'Yeni kullanıcı başarıyla oluşturuldu.' });
                setEmail('');
                setPassword('');
                setFullName('');
                onUserAdded();
                setOpen(false);
            }
        }
        setIsSubmitting(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Yeni Kullanıcı Oluştur</DialogTitle>
                    <DialogDescription>Yeni bir kullanıcı hesabı oluşturun.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div><Label htmlFor="fullName">Ad Soyad</Label><Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required /></div>
                    <div><Label htmlFor="email">E-posta Adresi</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
                    <div><Label htmlFor="password">Şifre</Label><Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
                    <DialogFooter><Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Oluşturuluyor...' : 'Kullanıcı Oluştur'}</Button></DialogFooter>
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
    const [isNewUserModalOpen, setNewUserModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [userPermissions, setUserPermissions] = useState({});

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase.rpc('get_all_users_with_profiles');
        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Kullanıcılar getirilemedi.' });
            console.error(error);
        } else {
            setUsers(data);
            const permissions = data.reduce((acc, user) => {
                acc[user.id] = user.raw_user_meta_data?.permissions || {};
                return acc;
            }, {});
            setUserPermissions(permissions);
        }
        setLoading(false);
    }, [toast]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handlePermissionChange = (userId, module, permission) => {
        setUserPermissions(prev => ({
            ...prev,
            [userId]: {
                ...prev[userId],
                [module]: permission,
            }
        }));
    };

    const savePermissions = async (userId) => {
        const permissionsToSave = userPermissions[userId];
        const user = users.find(u => u.id === userId);

        const { data, error } = await supabase.functions.invoke('manage-user', {
            body: {
                action: 'update_permissions',
                userId: userId,
                payload: {
                    permissions: permissionsToSave,
                    user_metadata: user.raw_user_meta_data
                }
            }
        });

        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: `İzinler güncellenemedi: ${error.message}` });
        } else {
            toast({ title: 'Başarılı', description: `${user.full_name || user.email} için izinler kaydedildi.` });
            logAudit('İzin Güncelleme', { userId, newPermissions: permissionsToSave }, 'profiles');
            fetchUsers();
        }
    };
    
    const deleteUser = async (userId) => {
        const userToDelete = users.find(u => u.id === userId);
        if (userToDelete.email === 'atakan.battal@kademe.com.tr') {
            toast({ variant: 'destructive', title: 'İşlem Reddedildi', description: 'Ana admin hesabı silinemez.' });
            return;
        }

        const { error } = await supabase.functions.invoke('manage-user', {
            body: {
                action: 'delete_user',
                userId: userId,
                payload: { email: userToDelete.email }
            }
        });

        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: `Kullanıcı silinemedi: ${error.message}` });
        } else {
            toast({ title: 'Başarılı', description: 'Kullanıcı kalıcı olarak silindi.' });
            logAudit('Kullanıcı Silme', { userId }, 'auth.users');
            fetchUsers();
        }
    };

    const filteredUsers = useMemo(() => {
        if (!searchTerm) return users;
        const lowercasedTerm = searchTerm.toLowerCase();
        return users.filter(u =>
            (u.full_name && u.full_name.toLowerCase().includes(lowercasedTerm)) ||
            (u.email && u.email.toLowerCase().includes(lowercasedTerm))
        );
    }, [users, searchTerm]);

    const PermissionIcon = ({ permission }) => {
        switch (permission) {
            case 'full': return <Shield className="w-5 h-5 text-green-500" />;
            case 'read': return <Eye className="w-5 h-5 text-blue-500" />;
            default: return <ShieldOff className="w-5 h-5 text-red-500" />;
        }
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="dashboard-widget">
            <NewUserModal open={isNewUserModalOpen} setOpen={setNewUserModalOpen} onUserAdded={fetchUsers} />
            <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4">
                <h2 className="widget-title">Hesap ve İzin Yönetimi</h2>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative w-full sm:w-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Kullanıcı ara..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setNewUserModalOpen(true)} className="flex-shrink-0"><Plus className="w-4 h-4 mr-2" /> Yeni Kullanıcı</Button>
                </div>
            </div>

            <div className="space-y-6">
                {loading ? <p>Yükleniyor...</p> : filteredUsers.map(user => (
                    <div key={user.id} className="p-4 rounded-lg border">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-2">
                            <div>
                                <h3 className="font-semibold text-lg">{user.full_name || 'İsimsiz Kullanıcı'}</h3>
                                <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button size="sm" onClick={() => savePermissions(user.id)}><Save className="w-4 h-4 mr-2" /> İzinleri Kaydet</Button>
                                {user.email !== 'atakan.battal@kademe.com.tr' && (
                                     <AlertDialog>
                                        <AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="w-4 h-4 mr-2" /> Sil</Button></AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader><AlertDialogTitle>Emin misiniz?</AlertDialogTitle><AlertDialogDescription>Bu işlem geri alınamaz. "{user.full_name || user.email}" kullanıcısını kalıcı olarak sileceksiniz.</AlertDialogDescription></AlertDialogHeader>
                                            <AlertDialogFooter><AlertDialogCancel>İptal</AlertDialogCancel><AlertDialogAction onClick={() => deleteUser(user.id)}>Sil</AlertDialogAction></AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {ALL_MODULES.map(module => (
                                <div key={module} className="p-3 border rounded-md">
                                    <Label className="font-medium text-sm flex items-center justify-between">
                                        {moduleLabels[module]}
                                        <PermissionIcon permission={(userPermissions[user.id] && userPermissions[user.id][module]) || 'none'} />
                                    </Label>
                                    <Select
                                        value={(userPermissions[user.id] && userPermissions[user.id][module]) || 'none'}
                                        onValueChange={(value) => handlePermissionChange(user.id, module, value)}
                                        disabled={user.email === 'atakan.battal@kademe.com.tr'}
                                    >
                                        <SelectTrigger className="h-8 mt-2">
                                            <SelectValue placeholder="İzin Seçin" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none"><ShieldOff className="w-4 h-4 mr-2 text-red-500 inline-block" />Erişim Yok</SelectItem>
                                            <SelectItem value="read"><Eye className="w-4 h-4 mr-2 text-blue-500 inline-block" />Sadece Okuma</SelectItem>
                                            <SelectItem value="full"><Shield className="w-4 h-4 mr-2 text-green-500 inline-block" />Tam Erişim</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </motion.div>
    );
};

export default AccountManager;