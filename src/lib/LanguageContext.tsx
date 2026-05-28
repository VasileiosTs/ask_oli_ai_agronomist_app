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
  if (browserLang.startsWith('tr')) return 'tr';
  if (browserLang.startsWith('ro')) return 'ro';
  if (browserLang.startsWith('bg')) return 'bg';
  if (browserLang.startsWith('sq')) return 'sq';
  if (browserLang.startsWith('pt')) return 'pt';
  if (browserLang.startsWith('de')) return 'de';
  if (browserLang.startsWith('hi')) return 'hi';
  if (browserLang.startsWith('sw')) return 'sw';
  if (browserLang.startsWith('bn')) return 'bn';
  if (browserLang.startsWith('id')) return 'id';
  if (browserLang.startsWith('am')) return 'am';
  if (browserLang.startsWith('vi')) return 'vi';
  if (browserLang.startsWith('ha')) return 'ha';
  if (browserLang.startsWith('ur')) return 'ur';
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === 'Europe/Athens' || tz === 'Asia/Nicosia') return 'el';
    if (tz?.startsWith('Europe/Rome') || tz === 'Europe/Vatican') return 'it';
    if (tz?.startsWith('Europe/Madrid') || tz === 'Atlantic/Canary') return 'es';
    if (tz?.startsWith('Europe/Paris') || tz === 'Indian/Reunion') return 'fr';
    if (tz === 'Europe/Istanbul') return 'tr';
    if (tz === 'Europe/Bucharest') return 'ro';
    if (tz === 'Europe/Sofia') return 'bg';
    if (tz === 'Europe/Tirane') return 'sq';
    if (tz?.startsWith('Europe/Lisbon') || tz === 'Atlantic/Azores') return 'pt';
    if (tz?.startsWith('Europe/Berlin') || tz === 'Europe/Vienna' || tz === 'Europe/Zurich') return 'de';
    if (tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta') return 'hi';
    if (tz === 'Africa/Nairobi' || tz === 'Africa/Dar_es_Salaam' || tz === 'Africa/Kampala') return 'sw';
    if (tz === 'Asia/Dhaka') return 'bn';
    if (tz?.startsWith('Asia/Jakarta') || tz === 'Asia/Makassar' || tz === 'Asia/Jayapura') return 'id';
    if (tz === 'Africa/Addis_Ababa') return 'am';
    if (tz === 'Asia/Ho_Chi_Minh' || tz === 'Asia/Hanoi') return 'vi';
    if (tz === 'Africa/Lagos' || tz === 'Africa/Kano') return 'ha';
    if (tz === 'Asia/Karachi') return 'ur';
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
