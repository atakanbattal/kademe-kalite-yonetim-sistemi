
    import React, { createContext, useState, useEffect, useContext, useMemo } from 'react';
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
            } else {
              setProfile(data);
            }
          };
          fetchProfile();
        } else {
          setProfile(null);
        }
      }, [user]);

      const value = useMemo(() => ({
        user,
        profile,
        session,
        loading,
        signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
        signOut: () => supabase.auth.signOut(),
      }), [user, profile, session, loading]);

      return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
    };

    export const useAuth = () => {
      return useContext(AuthContext);
    };
  