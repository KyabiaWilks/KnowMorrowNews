import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type Language = 'en' | 'zh';
type Context = { language: Language; setLanguage: (language: Language) => void; t: (english: string, chinese: string) => string };
const AdminLanguageContext = createContext<Context>(null as unknown as Context);

export function AdminLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => localStorage.getItem('know-morrow.admin-language') === 'zh' ? 'zh' : 'en');
  const setLanguage = (next: Language) => {
    localStorage.setItem('know-morrow.admin-language', next);
    setLanguageState(next);
  };
  const value = useMemo(() => ({ language, setLanguage, t: (en: string, zh: string) => language === 'zh' ? zh : en }), [language]);
  return <AdminLanguageContext.Provider value={value}>{children}</AdminLanguageContext.Provider>;
}

export const useAdminLanguage = () => useContext(AdminLanguageContext);
