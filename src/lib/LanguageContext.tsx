import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { detectLang, dict, type Lang, type T } from './i18n';

interface LangCtx { lang: Lang; t: T; setLang: (l: Lang) => void; }

const Ctx = createContext<LangCtx>({ lang: 'en', t: dict.en, setLang: () => {} });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const c = localStorage.getItem('oli_lang') as Lang | null;
    if (c === 'el' || c === 'en') return c;
    return navigator.language?.toLowerCase().startsWith('el') ? 'el' : 'en';
  });

  useEffect(() => {
    detectLang().then(l => setLangState(l));
  }, []);

  const setLang = (l: Lang) => { localStorage.setItem('oli_lang', l); setLangState(l); };

  return <Ctx.Provider value={{ lang, t: dict[lang], setLang }}>{children}</Ctx.Provider>;
}

export const useLanguage = () => useContext(Ctx);
