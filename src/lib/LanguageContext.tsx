import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { detectLang, dict, type Lang, type T } from './i18n';

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
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === 'Europe/Athens' || tz === 'Asia/Nicosia') return 'el';
    if (tz?.startsWith('Europe/Rome') || tz === 'Europe/Vatican') return 'it';
    if (tz?.startsWith('Europe/Madrid') || tz === 'Atlantic/Canary') return 'es';
    if (tz?.startsWith('Europe/Paris') || tz === 'Indian/Reunion') return 'fr';
  } catch { /* ignore */ }
  return 'en';
}

const initialLang = typeof window !== 'undefined' ? getInitialLang() : 'en';
const Ctx = createContext<LangCtx>({ lang: initialLang, t: dict[initialLang], setLang: () => {} });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang);

  useEffect(() => {
    detectLang().then(l => {
      setLangState(l);
    });
  }, []);

  const setLang = (l: Lang) => {
    localStorage.setItem('oli_lang_manual', l);
    setLangState(l);
  };

  return <Ctx.Provider value={{ lang, t: dict[lang], setLang }}>{children}</Ctx.Provider>;
}

export const useLanguage = () => useContext(Ctx);
