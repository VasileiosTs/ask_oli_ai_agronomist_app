import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { detectLang, dict, type Lang, type T } from './i18n';

interface LangCtx { lang: Lang; t: T; setLang: (l: Lang) => void; }

const Ctx = createContext<LangCtx>({ lang: 'el', t: dict.el, setLang: () => {} });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    // Manual user choice takes priority
    const manual = localStorage.getItem('oli_lang_manual') as Lang | null;
    if (manual === 'el' || manual === 'en') return manual;
    // Default to Greek while async IP detection runs
    return 'el';
  });

  useEffect(() => {
    detectLang().then(l => setLangState(l));
  }, []);

  const setLang = (l: Lang) => { localStorage.setItem('oli_lang_manual', l); setLangState(l); };

  return <Ctx.Provider value={{ lang, t: dict[lang], setLang }}>{children}</Ctx.Provider>;
}

export const useLanguage = () => useContext(Ctx);
