import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, CheckCircle2, AlertTriangle, XCircle, Info, RefreshCw, X, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

const NotificationCenter = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [checkingSmartNotifications, setCheckingSmartNotifications] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        // Sadece atakan.battal@kademe.com.tr hesabı görebilsin
        if (user && user.email === 'atakan.battal@kademe.com.tr') {
            fetchNotifications();
            
            // Gerçek zamanlı bildirim dinleme
            const channel = supabase
                .channel('notifications-channel')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`
                }, (payload) => {
                    if (payload.eventType === 'INSERT') {
                        // Mükerrer bildirim kontrolü
                        setNotifications(prev => {
                            const exists = prev.some(n => n.id === payload.new.id);
                            if (exists) return prev;
                            return [payload.new, ...prev];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        setNotifications(prev => 
                            prev.map(n => n.id === payload.new.id ? payload.new : n)
                        );
                    } else if (payload.eventType === 'DELETE') {
                        setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
                    }
                })
                .subscribe();
            
            return () => {
                supabase.removeChannel(channel);
            };
        } else if (user) {
            // Diğer kullanıcılar için boş liste
            setNotifications([]);
            setLoading(false);
        }
    }, [user]);

    const fetchNotifications = async () => {
        // Sadece atakan.battal@kademe.com.tr hesabı görebilsin
        if (!user || user.email !== 'atakan.battal@kademe.com.tr') {
            setNotifications([]);
            setLoading(false);
            return;
        }
        
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50);
            
            if (error) {
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    console.warn('Bildirimler tablosu henüz oluşturulmamış');
            setNotifications([]);
                } else {
                    throw error;
                }
            } else {
                // Duplicate kontrolü - aynı title ve message'a sahip bildirimleri filtrele
                const uniqueNotifications = [];
                const seen = new Set();
                
                (data || []).forEach(notif => {
                    const key = `${notif.title}-${notif.message}-${notif.created_at}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        uniqueNotifications.push(notif);
                    }
                });
                
                setNotifications(uniqueNotifications);
            }
        } catch (error) {
            console.warn('Bildirimler yüklenemedi:', error.message);
            setNotifications([]);
        } finally {
            setLoading(false);
        }
    };

    const unreadCount = useMemo(() => {
        return notifications.filter(n => !n.is_read).length;
    }, [notifications]);

    const handleMarkAsRead = async (notificationId) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('id', notificationId);

            if (error) {
                // Tablo yoksa sessizce devam et
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    return;
                }
                throw error;
            }
            fetchNotifications();
        } catch (error) {
            console.warn('Bildirim güncellenemedi:', error.message);
        }
    };

    const handleMarkAllAsRead = async () => {
        if (!user || user.email !== 'atakan.battal@kademe.com.tr') return;
        
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('user_id', user.id)
                .eq('is_read', false);

            if (error) {
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    return;
                }
                throw error;
            }
            fetchNotifications();
        } catch (error) {
            console.warn('Bildirimler güncellenemedi:', error.message);
        }
    };

    const handleDeleteNotification = async (notificationId, e) => {
        e.stopPropagation(); // Parent onClick'i tetikleme
        
        if (!user || user.email !== 'atakan.battal@kademe.com.tr') return;
        
        try {
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('id', notificationId)
                .eq('user_id', user.id);

            if (error) {
                throw error;
            }
            
            // Optimistic update
            setNotifications(prev => prev.filter(n => n.id !== notificationId));
            
            toast({
                title: 'Bildirim silindi',
                description: 'Bildirim başarıyla silindi.',
            });
        } catch (error) {
            console.error('Bildirim silinemedi:', error);
            toast({
                title: 'Hata',
                description: 'Bildirim silinemedi. Lütfen tekrar deneyin.',
                variant: 'destructive',
            });
        }
    };

    const handleDeleteAllRead = async () => {
        if (!user || user.email !== 'atakan.battal@kademe.com.tr') return;
        
        try {
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('user_id', user.id)
                .eq('is_read', true);

            if (error) {
                throw error;
            }
            
            fetchNotifications();
            
            toast({
                title: 'Okunmuş bildirimler silindi',
                description: 'Tüm okunmuş bildirimler başarıyla silindi.',
            });
        } catch (error) {
            console.error('Bildirimler silinemedi:', error);
            toast({
                title: 'Hata',
                description: 'Bildirimler silinemedi. Lütfen tekrar deneyin.',
                variant: 'destructive',
            });
        }
    };

    const handleCheckSmartNotifications = async () => {
        if (!user || user.email !== 'atakan.battal@kademe.com.tr') return;
        
        setCheckingSmartNotifications(true);
        const beforeCount = notifications.length;
        
        try {
            const { error } = await supabase.rpc('run_all_smart_notifications');
            
            if (error) {
                throw error;
            }
            
            // Bildirimleri yeniden yükle
            setTimeout(async () => {
                await fetchNotifications();
                
                // Yeni bildirim sayısını kontrol et
                const afterCount = notifications.length;
                const newCount = afterCount - beforeCount;
                
                if (newCount > 0) {
                    toast({
                        title: 'Kontrol Tamamlandı',
                        description: `${newCount} yeni bildirim oluşturuldu.`,
                    });
                } else {
                    toast({
                        title: 'Kontrol Tamamlandı',
                        description: 'Tüm bildirimler güncel. Yeni bildirim oluşturulmadı.',
                    });
                }
            }, 1500);
        } catch (error) {
            console.error('Akıllı bildirimler kontrol edilemedi:', error);
            toast({
                title: 'Hata',
                description: 'Akıllı bildirimler kontrol edilemedi. Lütfen tekrar deneyin.',
                variant: 'destructive',
            });
        } finally {
            setCheckingSmartNotifications(false);
        }
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'SUPPLIER_REJECTION':
            case 'DEVIATION_CREATED':
            case 'QUARANTINE_OPENED':
            case 'NC_CREATED':
                return <AlertTriangle className="h-4 w-4 text-orange-500" />;
            case '8D_OVERDUE':
            case 'CALIBRATION_DUE':
            case 'DOCUMENT_EXPIRING':
                return <XCircle className="h-4 w-4 text-red-500" />;
            case 'COST_ANOMALY':
                return <AlertTriangle className="h-4 w-4 text-purple-500" />;
            default:
                return <Info className="h-4 w-4 text-blue-500" />;
        }
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'CRITICAL': return 'destructive';
            case 'HIGH': return 'destructive';
            case 'NORMAL': return 'secondary';
            case 'LOW': return 'outline';
            default: return 'outline';
        }
    };

    // Sadece atakan.battal@kademe.com.tr hesabı görebilsin
    if (!user || user.email !== 'atakan.battal@kademe.com.tr') {
        return null;
    }

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5" />
                        Bildirimler
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">Yükleniyor...</div>
                </CardContent>
            </Card>
        );
    }

    const displayNotifications = isExpanded ? notifications : notifications.slice(0, 2);
    const hasMore = notifications.length > 2 && !isExpanded;

    return (
        <Card>
            <CardHeader className="py-3 px-4">
                <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Bell className="h-4 w-4" />
                        Bildirim Merkezi
                        {unreadCount > 0 && (
                            <Badge variant="destructive" className="text-xs">{unreadCount}</Badge>
                        )}
                    </CardTitle>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 text-xs"
                                onClick={handleCheckSmartNotifications}
                                disabled={checkingSmartNotifications}
                                title="Sistem geneli akıllı uyarıları kontrol et"
                            >
                                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${checkingSmartNotifications ? 'animate-spin' : ''}`} />
                                Kontrol
                            </Button>
                    {unreadCount > 0 && (
                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleMarkAllAsRead}>
                            Okundu İşaretle
                        </Button>
                    )}
                            {notifications.filter(n => n.is_read).length > 0 && (
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 w-8 p-0"
                                    onClick={handleDeleteAllRead}
                                    title="Okunmuş bildirimleri sil"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            )}
                            {notifications.length > 2 && (
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 text-xs"
                                    onClick={() => setIsExpanded(!isExpanded)}
                                >
                                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
                                    {isExpanded ? 'Daralt' : `${notifications.length - 2} bildirim daha`}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
                {notifications.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Bildirim bulunmuyor.</p>
                    </div>
                ) : (
                    <div className={`space-y-2 overflow-y-auto pr-2 ${isExpanded ? 'max-h-[400px]' : 'max-h-[180px]'}`}>
                        {displayNotifications.map((notification) => (
                            <div
                                key={notification.id}
                                className={`group relative p-3 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
                                    notification.is_read
                                        ? 'bg-muted/30 border-muted'
                                        : 'bg-primary/5 border-primary/30 shadow-sm'
                                }`}
                                onClick={() => {
                                    if (!notification.is_read) {
                                        handleMarkAsRead(notification.id);
                                    }
                                    if (notification.action_url) {
                                        navigate(notification.action_url);
                                    }
                                }}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5 flex-shrink-0">
                                        {getNotificationIcon(notification.notification_type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-1.5">
                                            <h4 className={`font-semibold text-sm leading-tight ${notification.is_read ? 'text-muted-foreground' : 'text-foreground'}`}>
                                                {notification.title}
                                            </h4>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                {!notification.is_read && (
                                                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                                                )}
                                                <Badge 
                                                    variant={getPriorityColor(notification.priority)} 
                                                    className="text-[10px] px-1.5 py-0"
                                                >
                                                    {notification.priority === 'CRITICAL' ? 'KRİTİK' : 
                                                     notification.priority === 'HIGH' ? 'YÜKSEK' :
                                                     notification.priority === 'NORMAL' ? 'NORMAL' : 'DÜŞÜK'}
                                                </Badge>
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground mb-1 leading-relaxed line-clamp-2">
                                            {notification.message}
                                        </p>
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span>
                                                {format(new Date(notification.created_at), 'dd MMM yyyy, HH:mm', { locale: tr })}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => handleDeleteNotification(notification.id, e)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
                                        title="Bildirimi sil"
                                    >
                                        <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default NotificationCenter;

