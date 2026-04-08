import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { detectLang, dict, type Lang, type T } from './i18n';
// Initialize i18next (side-effect import — must run before any useTranslation calls)
import i18n from './i18next';

interface LangCtx { lang: Lang; t: T; setLang: (l: Lang) => void; }

const VALID_LANGS = Object.keys(dict) as Lang[];

function getInitialLang(): Lang {
  const manual = localStorage.getItem('oli_lang_manual') as Lang | null;
  if (manual && VALID_LANGS.includes(manual)) return manual;
  const browserLang = navigator.language?.toLowerCase() ?? '';
  if (browserLang.startsWith('el')) return 'el';
  if (browserLang.startsWith('it')) return 'it';
  if (browserLang.startsWith('es')) return 'es';
  if (browserLang.startsWith('fr')) return 'fr';
  if (browserLang.startsWith('ar')) return 'ar';
  return 'en';
}

const initialLang = typeof window !== 'undefined' ? getInitialLang() : 'en';
const Ctx = createContext<LangCtx>({ lang: initialLang, t: dict[initialLang], setLang: () => {} });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang);

  useEffect(() => {
    detectLang().then(l => {
      setLangState(l);
      // Keep i18next in sync for components using useTranslation()
      if (i18n.language !== l) i18n.changeLanguage(l);
    });
  }, []);

  const setLang = (l: Lang) => {
    localStorage.setItem('oli_lang_manual', l);
    setLangState(l);
    // Propagate to i18next so useTranslation() components react immediately
    i18n.changeLanguage(l);
  };

  return <Ctx.Provider value={{ lang, t: dict[lang], setLang }}>{children}</Ctx.Provider>;
}

export const useLanguage = () => useContext(Ctx);
