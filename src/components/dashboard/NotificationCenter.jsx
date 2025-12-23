import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
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

    useEffect(() => {
        if (user) {
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
                        setNotifications(prev => [payload.new, ...prev]);
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
        }
    }, [user]);

    const fetchNotifications = async () => {
        if (!user) return;
        
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50);
            
            if (error) {
                // Tablo yoksa sessizce devam et
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    console.warn('Bildirimler tablosu henüz oluşturulmamış');
                    setNotifications([]);
                } else {
                    throw error;
                }
            } else {
                setNotifications(data || []);
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
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('user_id', user.id)
                .eq('is_read', false);

            if (error) {
                // Tablo yoksa sessizce devam et
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

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5" />
                        Bildirim Merkezi
                        {unreadCount > 0 && (
                            <Badge variant="destructive">{unreadCount}</Badge>
                        )}
                    </CardTitle>
                    {unreadCount > 0 && (
                        <Button variant="outline" size="sm" onClick={handleMarkAllAsRead}>
                            Tümünü Okundu İşaretle
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {notifications.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Bildirim bulunmuyor.</p>
                    </div>
                ) : (
                    <div className="space-y-2 max-h-[600px] overflow-y-auto">
                        {notifications.map((notification) => (
                            <div
                                key={notification.id}
                                className={`p-3 rounded-lg border transition-colors cursor-pointer hover:bg-accent ${
                                    notification.is_read
                                        ? 'bg-muted/50 border-muted'
                                        : 'bg-primary/5 border-primary/20'
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
                                    <div className="mt-1">
                                        {getNotificationIcon(notification.notification_type)}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <h4 className={`font-semibold text-sm ${notification.is_read ? '' : 'font-bold'}`}>
                                                {notification.title}
                                            </h4>
                                            <div className="flex items-center gap-2">
                                                <Badge variant={getPriorityColor(notification.priority)} className="text-xs">
                                                    {notification.priority}
                                                </Badge>
                                                {!notification.is_read && (
                                                    <div className="w-2 h-2 bg-primary rounded-full" />
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-2">
                                            {notification.message}
                                        </p>
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span>
                                                {format(new Date(notification.created_at), 'dd MMM yyyy HH:mm', { locale: tr })}
                                            </span>
                                            {notification.related_module && (
                                                <Badge variant="outline" className="text-xs">
                                                    {notification.related_module}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
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

