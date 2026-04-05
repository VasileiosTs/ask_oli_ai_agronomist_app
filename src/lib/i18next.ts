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
import { dict } from './i18n';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: dict.en },
      el: { translation: dict.el },
    },
    // Language is set by LanguageContext after detectLang() resolves.
    // We use a safe default here; LanguageProvider will call changeLanguage().
    lng: (() => {
      const manual = typeof window !== 'undefined'
        ? localStorage.getItem('oli_lang_manual')
        : null;
      if (manual === 'el' || manual === 'en') return manual;
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
