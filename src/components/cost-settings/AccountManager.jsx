import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Search, Plus, Save, Trash2, Shield, Eye, ShieldOff, CheckSquare, Square, LayoutGrid, List, Copy, Users2 } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const ALL_MODULES = [
    'dashboard', 'kpi', 'kaizen', 'df-8d', 'quality-cost', 
    'supplier-quality', 'customer-complaints', 'incoming-quality', 'produced-vehicles', 
    'internal-audit', 'deviation', 'equipment', 'quarantine', 
    'training', 'polyvalence', 'document', 'wps', 'tasks', 'process-control', 'settings', 'audit-logs'
];

const moduleLabels = {
    dashboard: 'Ana Panel', kpi: 'KPI', kaizen: 'Kaizen', 'df-8d': 'DF/8D', 
    'quality-cost': 'Maliyet', 'supplier-quality': 'Tedarikçi', 'customer-complaints': 'Müşteri Şikayetleri',
    'incoming-quality': 'Girdi Kalite', 'produced-vehicles': 'Üretilen Araçlar', 
    'internal-audit': 'İç Tetkik', deviation: 'Sapma', equipment: 'Ekipman', 
    quarantine: 'Karantina', training: 'Eğitim', polyvalence: 'Polivalans',
    document: 'Doküman', wps: 'WPS', tasks: 'Görevler', 'process-control': 'Proses Kontrol', settings: 'Ayarlar', 'audit-logs': 'Denetim Kayıtları'
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
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [bulkPermission, setBulkPermission] = useState({ module: '', permission: '' });
    const [viewMode, setViewMode] = useState('compact'); // 'compact' or 'detailed'
    const [permissionTemplates, setPermissionTemplates] = useState({
        'admin': { label: 'Yönetici (Tam Yetki)', permissions: Object.fromEntries(ALL_MODULES.map(m => [m, 'full'])) },
        'viewer': { label: 'Görüntüleyici', permissions: Object.fromEntries(ALL_MODULES.map(m => [m, 'read'])) },
        'operator': { label: 'Operatör', permissions: { 
            dashboard: 'read', kpi: 'read', kaizen: 'full', 'df-8d': 'full', 
            'quality-cost': 'read', 'supplier-quality': 'read', 'customer-complaints': 'full',
            'incoming-quality': 'full', 'produced-vehicles': 'full', 'internal-audit': 'read',
            deviation: 'full', equipment: 'read', quarantine: 'full', training: 'read',
            polyvalence: 'read', document: 'read', wps: 'read', tasks: 'full',
            settings: 'none', 'audit-logs': 'none'
        }}
    });

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
        const permissionsToSave = userPermissions[userId] || {};
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

    const applyBulkPermission = async () => {
        if (!bulkPermission.module || !bulkPermission.permission || selectedUsers.length === 0) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Lütfen kullanıcı, modül ve izin seçin.' });
            return;
        }

        const updatedPermissions = { ...userPermissions };
        selectedUsers.forEach(userId => {
            if (!updatedPermissions[userId]) updatedPermissions[userId] = {};
            updatedPermissions[userId][bulkPermission.module] = bulkPermission.permission;
        });
        setUserPermissions(updatedPermissions);

        // Save all selected users
        for (const userId of selectedUsers) {
            await savePermissions(userId);
        }

        toast({ title: 'Başarılı', description: `${selectedUsers.length} kullanıcı için ${moduleLabels[bulkPermission.module]} izinleri güncellendi.` });
        setSelectedUsers([]);
        setBulkPermission({ module: '', permission: '' });
    };

    const applyTemplate = async (userId, templateKey) => {
        const template = permissionTemplates[templateKey];
        if (!template) return;

        setUserPermissions(prev => ({
            ...prev,
            [userId]: template.permissions
        }));

        await savePermissions(userId);
        toast({ title: 'Başarılı', description: `${template.label} şablonu uygulandı.` });
    };

    const toggleUserSelection = (userId) => {
        setSelectedUsers(prev => 
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const toggleAllUsers = () => {
        if (selectedUsers.length === filteredUsers.filter(u => u.email !== 'atakan.battal@kademe.com.tr').length) {
            setSelectedUsers([]);
        } else {
            setSelectedUsers(filteredUsers.filter(u => u.email !== 'atakan.battal@kademe.com.tr').map(u => u.id));
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

    const PermissionIcon = ({ permission, size = 'md' }) => {
        const sizeClass = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
        switch (permission) {
            case 'full': return <Shield className={`${sizeClass} text-green-500`} />;
            case 'read': return <Eye className={`${sizeClass} text-blue-500`} />;
            default: return <ShieldOff className={`${sizeClass} text-red-500`} />;
        }
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="dashboard-widget space-y-6">
            <NewUserModal open={isNewUserModalOpen} setOpen={setNewUserModalOpen} onUserAdded={fetchUsers} />
            
            {/* Header */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="widget-title">Hesap ve İzin Yönetimi</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            {filteredUsers.length} kullanıcı • {selectedUsers.length} seçili
                        </p>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Kullanıcı ara..." 
                                className="pl-10" 
                                value={searchTerm} 
                                onChange={(e) => setSearchTerm(e.target.value)} 
                            />
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setNewUserModalOpen(true)} className="flex-shrink-0">
                            <Plus className="w-4 h-4 mr-2" /> Yeni Kullanıcı
                        </Button>
                    </div>
                </div>

                {/* Toplu İşlem Paneli */}
                {selectedUsers.length > 0 && (
                    <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                        <CardContent className="pt-4">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <Users2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                    <span className="font-medium text-blue-900 dark:text-blue-100">
                                        {selectedUsers.length} kullanıcı seçildi
                                    </span>
                                </div>
                                <Separator orientation="vertical" className="hidden sm:block h-8" />
                                <div className="flex flex-wrap items-center gap-2 flex-1">
                                    <Select 
                                        value={bulkPermission.module} 
                                        onValueChange={(val) => setBulkPermission(prev => ({ ...prev, module: val }))}
                                    >
                                        <SelectTrigger className="w-[180px] bg-white dark:bg-gray-900">
                                            <SelectValue placeholder="Modül seçin" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ALL_MODULES.map(mod => (
                                                <SelectItem key={mod} value={mod}>{moduleLabels[mod]}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Select 
                                        value={bulkPermission.permission} 
                                        onValueChange={(val) => setBulkPermission(prev => ({ ...prev, permission: val }))}
                                    >
                                        <SelectTrigger className="w-[160px] bg-white dark:bg-gray-900">
                                            <SelectValue placeholder="İzin seçin" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none"><ShieldOff className="w-4 h-4 mr-2 text-red-500 inline-block" />Erişim Yok</SelectItem>
                                            <SelectItem value="read"><Eye className="w-4 h-4 mr-2 text-blue-500 inline-block" />Sadece Okuma</SelectItem>
                                            <SelectItem value="full"><Shield className="w-4 h-4 mr-2 text-green-500 inline-block" />Tam Erişim</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button onClick={applyBulkPermission} size="sm">
                                        <Save className="w-4 h-4 mr-2" /> Toplu Uygula
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => setSelectedUsers([])}>
                                        İptal
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Seçim ve Görünüm Kontrolü */}
                <div className="flex items-center justify-between">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={toggleAllUsers}
                        disabled={filteredUsers.filter(u => u.email !== 'atakan.battal@kademe.com.tr').length === 0}
                    >
                        {selectedUsers.length === filteredUsers.filter(u => u.email !== 'atakan.battal@kademe.com.tr').length ? (
                            <><CheckSquare className="w-4 h-4 mr-2" /> Tümünün Seçimini Kaldır</>
                        ) : (
                            <><Square className="w-4 h-4 mr-2" /> Tümünü Seç</>
                        )}
                    </Button>
                    <div className="flex items-center gap-2">
                        <Button 
                            variant={viewMode === 'compact' ? 'default' : 'outline'} 
                            size="sm"
                            onClick={() => setViewMode('compact')}
                        >
                            <LayoutGrid className="w-4 h-4 mr-2" /> Kompakt
                        </Button>
                        <Button 
                            variant={viewMode === 'detailed' ? 'default' : 'outline'} 
                            size="sm"
                            onClick={() => setViewMode('detailed')}
                        >
                            <List className="w-4 h-4 mr-2" /> Detaylı
                        </Button>
                    </div>
                </div>
            </div>

            {/* Kullanıcı Listesi */}
            <div className="space-y-4">
                {loading ? (
                    <div className="text-center py-12">
                        <p className="text-muted-foreground">Yükleniyor...</p>
                    </div>
                ) : viewMode === 'compact' ? (
                    /* Kompakt Görünüm */
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {filteredUsers.map(user => (
                            <Card key={user.id} className={selectedUsers.includes(user.id) ? 'ring-2 ring-primary' : ''}>
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-3 flex-1">
                                            {user.email !== 'atakan.battal@kademe.com.tr' && (
                                                <Checkbox 
                                                    checked={selectedUsers.includes(user.id)}
                                                    onCheckedChange={() => toggleUserSelection(user.id)}
                                                    className="mt-1"
                                                />
                                            )}
                                            <div className="flex-1">
                                                <CardTitle className="text-lg">{user.full_name || 'İsimsiz Kullanıcı'}</CardTitle>
                                                <CardDescription className="mt-1">{user.email}</CardDescription>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {Object.keys(permissionTemplates).map(key => (
                                                <Button 
                                                    key={key} 
                                                    variant="ghost" 
                                                    size="sm"
                                                    onClick={() => applyTemplate(user.id, key)}
                                                    title={permissionTemplates[key].label}
                                                    disabled={user.email === 'atakan.battal@kademe.com.tr'}
                                                >
                                                    <Copy className="w-3 h-3" />
                                                </Button>
                                            ))}
                                            {user.email !== 'atakan.battal@kademe.com.tr' && (
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="sm"><Trash2 className="w-4 h-4 text-red-500" /></Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Bu işlem geri alınamaz. "{user.full_name || user.email}" kullanıcısını kalıcı olarak sileceksiniz.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>İptal</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => deleteUser(user.id)}>Sil</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            )}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-wrap gap-2">
                                        {ALL_MODULES.slice(0, 6).map(module => {
                                            const perm = (userPermissions[user.id] && userPermissions[user.id][module]) || 'none';
                                            return (
                                                <Badge 
                                                    key={module} 
                                                    variant={perm === 'full' ? 'default' : perm === 'read' ? 'secondary' : 'outline'}
                                                    className="text-xs flex items-center gap-1"
                                                >
                                                    <PermissionIcon permission={perm} size="sm" />
                                                    <span>{moduleLabels[module]}</span>
                                                </Badge>
                                            );
                                        })}
                                        {ALL_MODULES.length > 6 && (
                                            <Badge variant="outline" className="text-xs">
                                                +{ALL_MODULES.length - 6} daha
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex justify-end mt-4">
                                        <Button size="sm" onClick={() => savePermissions(user.id)}>
                                            <Save className="w-4 h-4 mr-2" /> Kaydet
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : (
                    /* Detaylı Görünüm */
                    filteredUsers.map(user => (
                        <Card key={user.id} className={selectedUsers.includes(user.id) ? 'ring-2 ring-primary' : ''}>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {user.email !== 'atakan.battal@kademe.com.tr' && (
                                            <Checkbox 
                                                checked={selectedUsers.includes(user.id)}
                                                onCheckedChange={() => toggleUserSelection(user.id)}
                                            />
                                        )}
                                        <div>
                                            <CardTitle className="text-lg">{user.full_name || 'İsimsiz Kullanıcı'}</CardTitle>
                                            <CardDescription className="mt-1">{user.email}</CardDescription>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Select onValueChange={(val) => applyTemplate(user.id, val)} disabled={user.email === 'atakan.battal@kademe.com.tr'}>
                                            <SelectTrigger className="w-[180px]">
                                                <SelectValue placeholder="Şablon uygula" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(permissionTemplates).map(([key, template]) => (
                                                    <SelectItem key={key} value={key}>{template.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button size="sm" onClick={() => savePermissions(user.id)}>
                                            <Save className="w-4 h-4 mr-2" /> Kaydet
                                        </Button>
                                        {user.email !== 'atakan.battal@kademe.com.tr' && (
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="destructive" size="sm"><Trash2 className="w-4 h-4 mr-2" /> Sil</Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Bu işlem geri alınamaz. "{user.full_name || user.email}" kullanıcısını kalıcı olarak sileceksiniz.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>İptal</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => deleteUser(user.id)}>Sil</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                    {ALL_MODULES.map(module => (
                                        <div key={module} className="p-3 border rounded-md hover:border-primary transition-colors">
                                            <Label className="font-medium text-sm flex items-center justify-between mb-2">
                                                <span className="truncate">{moduleLabels[module]}</span>
                                                <PermissionIcon permission={(userPermissions[user.id] && userPermissions[user.id][module]) || 'none'} />
                                            </Label>
                                            <Select
                                                value={(userPermissions[user.id] && userPermissions[user.id][module]) || 'none'}
                                                onValueChange={(value) => handlePermissionChange(user.id, module, value)}
                                                disabled={user.email === 'atakan.battal@kademe.com.tr'}
                                            >
                                                <SelectTrigger className="h-8">
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
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </motion.div>
    );
};

export default AccountManager;