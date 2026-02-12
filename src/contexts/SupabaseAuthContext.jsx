
    import React, { createContext, useState, useEffect, useContext, useMemo, useCallback } from 'react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useNavigate } from 'react-router-dom';

    export const AuthContext = createContext();

    export const AuthProvider = ({ children }) => {
      const [user, setUser] = useState(null);
      const [profile, setProfile] = useState(null);
      const [session, setSession] = useState(null);
      const [loading, setLoading] = useState(true);
      const navigate = useNavigate();

      useEffect(() => {
        const fetchSession = async () => {
          try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) throw error;
            setSession(session);
            setUser(session?.user ?? null);
          } catch (error) {
            console.error("Error fetching session:", error);
          } finally {
            setLoading(false);
          }
        };

        fetchSession();

        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
          if (event === 'SIGNED_OUT') {
            setProfile(null);
            navigate('/login');
          }
        });

        return () => {
          authListener?.subscription.unsubscribe();
        };
      }, [navigate]);

      useEffect(() => {
        if (user) {
          const fetchProfile = async () => {
            const { data, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .single();

            if (error) {
              console.error('Error fetching profile:', error);
              // Profil yüklenemezse user_metadata'dan permissions kullan (auth sync)
              const merged = { id: user.id, full_name: user.user_metadata?.full_name, permissions: user.user_metadata?.permissions || {} };
              setProfile(merged);
            } else {
              // profiles.permissions boşsa auth.users.raw_user_meta_data'dan fallback
              const authPerms = user.user_metadata?.permissions;
              const perms = (data.permissions && Object.keys(data.permissions).length > 0) ? data.permissions : (authPerms || {});
              setProfile({ ...data, permissions: perms });
            }
          };
          fetchProfile();
        } else {
          setProfile(null);
        }
      }, [user]);

      const signIn = useCallback(async (email, password) => {
        const result = await supabase.auth.signInWithPassword({ email, password });
        // Session state'i onAuthStateChange listener'ı otomatik güncelleyecek
        // Ancak hemen güncellemek için manuel kontrol edelim
        if (result.data?.session) {
          setSession(result.data.session);
          setUser(result.data.session.user);
        }
        return result;
      }, []);

      const signOut = useCallback(async () => {
        console.log('🔐 SignOut başlatılıyor...');
        try {
            // Önce Supabase'den çıkış yap
            const { error } = await supabase.auth.signOut({ scope: 'global' });
            
            if (error) {
                console.error('Sign out error:', error);
            }
            
            // Ardından state'i temizle
            console.log('🔐 Session state temizleniyor...');
            setSession(null);
            setUser(null);
            setProfile(null);
            
            // Manuel olarak login'e yönlendir
            console.log('🔐 Login sayfasına yönlendiriliyor...');
            navigate('/login', { replace: true });
            
            return { error: null };
        } catch (error) {
            console.error('Sign out error:', error);
            // Hata durumunda da state'i temizle ve login'e yönlendir
            setSession(null);
            setUser(null);
            setProfile(null);
            navigate('/login', { replace: true });
            return { error };
        }
      }, [navigate]);

      const value = useMemo(() => ({
        user,
        profile,
        session,
        loading,
        signIn,
        signOut,
      }), [user, profile, session, loading, signIn, signOut]);

      return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
    };

    export const useAuth = () => {
      return useContext(AuthContext);
    };
  