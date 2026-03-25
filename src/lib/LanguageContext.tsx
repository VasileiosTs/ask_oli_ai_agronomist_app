import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { detectLang, dict, type Lang, type T } from './i18n';

interface LangCtx { lang: Lang; t: T; setLang: (l: Lang) => void; }

function getInitialLang(): Lang {
  const manual = localStorage.getItem('oli_lang_manual') as Lang | null;
  if (manual === 'el' || manual === 'en') return manual;
  // Use browser language as initial default while async IP detection runs
  return navigator.language?.startsWith('el') ? 'el' : 'en';
}

const initialLang = typeof window !== 'undefined' ? getInitialLang() : 'en';
const Ctx = createContext<LangCtx>({ lang: initialLang, t: dict[initialLang], setLang: () => {} });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang);

  useEffect(() => {
    detectLang().then(l => setLangState(l));
  }, []);

  const setLang = (l: Lang) => { localStorage.setItem('oli_lang_manual', l); setLangState(l); };

  return <Ctx.Provider value={{ lang, t: dict[lang], setLang }}>{children}</Ctx.Provider>;
}

export const useLanguage = () => useContext(Ctx);
