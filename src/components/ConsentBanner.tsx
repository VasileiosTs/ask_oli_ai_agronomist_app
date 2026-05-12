import { useState, useEffect } from 'react';
import { useLanguage } from '../lib/LanguageContext';

const CONSENT_KEY = 'oli_gdpr_consent';

/** Update Google Consent Mode v2 via the globally-defined gtag function. */
function updateConsent(value: 'granted' | 'denied') {
  if (typeof window.gtag === 'function') {
    window.gtag('consent', 'update', {
      ad_storage: value,
      ad_user_data: value,
      ad_personalization: value,
      analytics_storage: value,
    });
  }
}

export default function ConsentBanner() {
  const { lang } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show if the user hasn't made a choice yet.
    // Returning users are handled by the inline script in index.html.
    if (localStorage.getItem(CONSENT_KEY) !== null) return;

    // Small delay so the banner doesn't compete with the initial render.
    const t = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(t);
  }, []);

  function handleAccept() {
    localStorage.setItem(CONSENT_KEY, 'granted');
    updateConsent('granted');
    setVisible(false);
  }

  function handleDecline() {
    localStorage.setItem(CONSENT_KEY, 'denied');
    updateConsent('denied');
    setVisible(false);
  }

  if (!visible) return null;

  const isEl = lang === 'el';

  return (
    <div
      role="dialog"
      aria-label={isEl ? 'Ρυθμίσεις cookies' : 'Cookie settings'}
      className="fixed bottom-0 left-0 right-0 z-[9999] px-4 pb-4 pt-0"
    >
      <div className="mx-auto max-w-2xl rounded-2xl border border-[#194121]/12 bg-white p-5 shadow-2xl"
        style={{ boxShadow: '0 -4px 32px rgba(25,65,33,0.12), 0 8px 24px rgba(0,0,0,0.08)' }}>

        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#194121]/8">
            <img src="/favicon.svg" alt="" className="h-4 w-4" aria-hidden="true" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#1b1c19]">
              {isEl ? 'Ο Oli χρησιμοποιεί analytics' : 'Oli uses analytics'}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-[#606659]">
              {isEl
                ? 'Χρησιμοποιούμε cookies ανάλυσης (Google Analytics) για να κατανοούμε πώς χρησιμοποιείται η εφαρμογή και να τη βελτιώνουμε. '
                : 'We use analytics cookies (Google Analytics) to understand how the app is used and improve it. '}
              <a
                href="/legal/privacy"
                className="underline text-[#194121] hover:opacity-75 transition-opacity"
                target="_blank"
                rel="noopener noreferrer"
              >
                {isEl ? 'Πολιτική Απορρήτου' : 'Privacy Policy'}
              </a>
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={handleAccept}
            className="flex-1 rounded-xl bg-[#194121] py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
          >
            {isEl ? 'Αποδοχή' : 'Accept'}
          </button>
          <button
            onClick={handleDecline}
            className="flex-1 rounded-xl border border-[#194121]/20 bg-transparent py-2.5 text-sm font-medium text-[#606659] transition-colors hover:border-[#194121]/40 hover:text-[#1b1c19] active:bg-[#f5f4ef]"
          >
            {isEl ? 'Απόρριψη' : 'Decline'}
          </button>
        </div>
      </div>
    </div>
  );
}
