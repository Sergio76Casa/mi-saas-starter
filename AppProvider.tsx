import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase, isConfigured } from './supabaseClient';
import { Membership, Profile, Language } from './types';
import { translations } from './i18n';

export interface AppContextType {
  session: Session | null;
  profile: Profile | null;
  memberships: Membership[];
  loading: boolean;
  isDemoMode: boolean;
  dbHealthy: boolean | null;
  language: Language;
  setLanguage: (lang: Language) => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  enterDemoMode: (asAdmin?: boolean) => void;
  t: (key: keyof typeof translations['es']) => string;
}

const AppContext = createContext<AppContextType | null>(null);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbHealthy, setDbHealthy] = useState<boolean | null>(null);
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('app_lang');
      if (saved === 'es' || saved === 'ca') return saved;
    } catch (e) {}
    return 'es';
  });

  const setLanguage = (lang: Language) => { 
    setLanguageState(lang); 
    try {
      localStorage.setItem('app_lang', lang); 
    } catch (e) {}
  };
  
  const t_func = (key: keyof typeof translations['es']) => {
    const langSet = translations[language] || translations['es'];
    return (langSet as any)[key] || (translations['es'] as any)[key] || key;
  };

  // Verificación de conectividad inicial
  useEffect(() => {
    if (!supabase || !isConfigured) { 
      setDbHealthy(false); 
      setLoading(false);
      return; 
    }
    
    const checkConnectivity = async () => {
      try {
        const { error } = await supabase!.from('tenants').select('count', { count: 'exact', head: true });
        if (error) {
          const status = (error as any).status;
          const isAuthOrPermissionError = status === 401 || status === 403 || error.code?.startsWith('PGRST');
          setDbHealthy(isAuthOrPermissionError || !error);
        } else {
          setDbHealthy(true);
        }
      } catch (e) {
        setDbHealthy(false);
      }
    };
    checkConnectivity();
  }, []);

  const fetchProfileData = async (userId: string) => {
    if (!supabase || !isConfigured) return;
    try {
      const { data: profileData } = await supabase!.from('profiles').select('*').eq('id', userId).single();
      if (profileData) setProfile(profileData);
      
      const { data: membershipData } = await supabase!.from('memberships').select('*, tenant:tenants(*)').eq('user_id', userId);
      if (membershipData) setMemberships(membershipData as any);
    } catch (e) {
      console.error("Error fetching profile data:", e);
    }
  };

  useEffect(() => {
    if (!supabase || !isConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        if (session) fetchProfileData(session.user.id).finally(() => setLoading(false));
        else setLoading(false);
    }).catch(err => {
        setLoading(false);
    });
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        if (session) fetchProfileData(session.user.id);
        else { setProfile(null); setMemberships([]); }
    });
    
    return () => subscription.unsubscribe();
  }, [dbHealthy]);

  const refreshProfile = async () => { 
    if (session) await fetchProfileData(session.user.id); 
  };
  
  const signOut = async () => { 
    if (supabase && isConfigured) await supabase.auth.signOut(); 
    setSession(null); 
    setProfile(null); 
    setMemberships([]); 
  };
  
  const enterDemoMode = (asAdmin = false) => { 
    if (asAdmin) {
      setSession({ user: { id: 'admin', email: 'admin@system.com' } } as any);
      setProfile({ id: 'admin', email: 'admin@system.com', is_superadmin: true, full_name: 'Super Administrator' });
      setMemberships([]);
    } else {
      setSession({ user: { id: 'demo', email: 'demo@demo.com' } } as any);
      setProfile({ id: 'demo', email: 'demo@demo.com', is_superadmin: false, full_name: 'Usuario Demo' });
      setMemberships([{ id: 'm1', user_id: 'demo', tenant_id: 't1', role: 'owner', tenant: { id: 't1', name: 'Demo Corp', slug: 'demo', plan: 'pro', created_at: '' } }]);
    }
    setLoading(false); 
  };

  const contextValue = useMemo(() => ({
    session,
    profile,
    memberships,
    loading,
    isDemoMode: !!(session?.user?.id === 'demo' || session?.user?.id === 'admin'),
    dbHealthy,
    language,
    setLanguage,
    t: t_func,
    refreshProfile,
    signOut,
    enterDemoMode
  }), [session, profile, memberships, loading, dbHealthy, language]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};