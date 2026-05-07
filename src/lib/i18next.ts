/**
 * react-i18next setup
 *
 * Translations are loaded inline from our TypeScript dict so there are no
 * network requests and the bundle stays tree-shakeable.
 *
 * Existing components keep using `useLanguage()` + `t.key` (no changes needed).
 * New components can use `useTranslation()` + `t('key')` directly.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { dict, type Lang } from './i18n';

const VALID_LANGS = Object.keys(dict) as Lang[];

function getStoredLang(): Lang | null {
  if (typeof window === 'undefined') return null;

  const storage = window.localStorage;
  if (!storage || typeof storage.getItem !== 'function') return null;

  const manual = storage.getItem('oli_lang_manual');
  return VALID_LANGS.includes(manual as Lang) ? (manual as Lang) : null;
}

function detectInitialLang(): Lang {
  const manual = getStoredLang();
  if (manual) return manual;

  if (typeof window !== 'undefined') {
    const browserLang = navigator.language?.toLowerCase() ?? '';
    if (browserLang.startsWith('el')) return 'el';
    if (browserLang.startsWith('it')) return 'it';
    if (browserLang.startsWith('es')) return 'es';
    if (browserLang.startsWith('fr')) return 'fr';
    if (browserLang.startsWith('ar')) return 'ar';
  }

  return 'en';
}

function getStoredManualLanguage(): 'en' | 'el' | null {
  try {
    if (typeof window === 'undefined') {
      return null;
    }

    const storage = window.localStorage;
    if (!storage || typeof storage.getItem !== 'function') {
      return null;
    }

    const manual = storage.getItem('oli_lang_manual');
    return manual === 'el' || manual === 'en' ? manual : null;
  } catch {
    return null;
  }
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: dict.en },
      el: { translation: dict.el },
      it: { translation: dict.it },
      es: { translation: dict.es },
      fr: { translation: dict.fr },
      ar: { translation: dict.ar },
    },
    // Language is set by LanguageContext after detectLang() resolves.
    // We use a safe default here; LanguageProvider will call changeLanguage().
    lng: (() => {
      const manual = getStoredManualLanguage();
      if (manual) return manual;
      if (typeof window !== 'undefined' && navigator.language?.startsWith('el')) return 'el';
      return 'en';
    })(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    // Allow returning objects/arrays with returnObjects: true
    returnObjects: true,
  });

export default i18n;
