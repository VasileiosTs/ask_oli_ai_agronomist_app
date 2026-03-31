import { useState, useEffect, useRef } from 'react';
import { X, Download, Share } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const SESSION_COUNT_KEY = 'oli_install_sessions';
const DISMISS_KEY = 'oli_install_dismissed';
const DISMISS_HOURS = 24;

/** Detect iOS Safari (not in standalone mode) */
function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  const isStandalone = ('standalone' in navigator && (navigator as any).standalone) ||
    window.matchMedia('(display-mode: standalone)').matches;
  return isIos && isSafari && !isStandalone;
}

/** Check if already installed as PWA */
function isInstalledPwa(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as any).standalone === true);
}

/** Check if recently dismissed */
function wasDismissed(): boolean {
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const ts = parseInt(raw, 10);
  if (isNaN(ts)) return false;
  const hoursSince = (Date.now() - ts) / (1000 * 60 * 60);
  return hoursSince < DISMISS_HOURS;
}

/** Increment session count and return the new value */
function incrementSessionCount(): number {
  // Use sessionStorage flag to only count once per browser session
  if (sessionStorage.getItem('oli_install_counted')) {
    return parseInt(localStorage.getItem(SESSION_COUNT_KEY) || '0', 10);
  }
  sessionStorage.setItem('oli_install_counted', '1');

  const current = parseInt(localStorage.getItem(SESSION_COUNT_KEY) || '0', 10);
  const next = current + 1;
  localStorage.setItem(SESSION_COUNT_KEY, next.toString());
  return next;
}

export default function InstallPrompt() {
  const { lang } = useLanguage();
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isInstalledPwa()) return;

    // Capture native install prompt (Android/Desktop)
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Check session count: show on 1st login and every 3rd session
    const sessionCount = incrementSessionCount();
    const shouldShow = sessionCount === 1 || sessionCount % 3 === 0;

    if (!shouldShow || wasDismissed()) {
      return () => window.removeEventListener('beforeinstallprompt', handler);
    }

    // Delay showing the prompt
    const timer = setTimeout(() => {
      if (isIosSafari()) {
        setIsIos(true);
      }
      setShow(true);
    }, 15000); // 15 seconds

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPromptRef.current) {
      await deferredPromptRef.current.prompt();
      const { outcome } = await deferredPromptRef.current.userChoice;
      if (outcome === 'accepted') {
        setShow(false);
      }
      deferredPromptRef.current = null;
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-[80px] md:bottom-20 left-4 right-4 z-50 mx-auto max-w-sm animate-slide-up">
      <div className="rounded-2xl bg-white border border-[#194121]/10 p-5 shadow-xl"
        style={{ boxShadow: '0 12px 40px rgba(25,65,33,0.15)' }}>

        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1.5 rounded-full text-[#606659] hover:bg-[#f5f4ef] transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-4">
          {/* App icon */}
          <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-[#194121] flex items-center justify-center"
            style={{ boxShadow: '0 4px 12px rgba(25,65,33,0.3)' }}>
            <img src="/favicon.svg" alt="Oli" className="w-8 h-8" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-[#194121] text-base mb-0.5">
              {lang === 'el' ? 'Εγκατάστησε τον Oli' : 'Install Oli'}
            </h3>
            <p className="text-sm text-[#606659] leading-snug">
              {isIos
                ? (lang === 'el'
                  ? 'Άνοιξε αμέσως από την αρχική σου οθόνη.'
                  : 'Open instantly from your home screen.')
                : (lang === 'el'
                  ? 'Πρόσβαση με ένα tap. Λειτουργεί σαν εφαρμογή.'
                  : 'One-tap access. Works like a native app.')}
            </p>
          </div>
        </div>

        {isIos ? (
          /* iOS instructions */
          <div className="mt-4 bg-[#f5f4ef] rounded-xl p-4">
            <div className="flex items-center gap-3 text-sm text-[#1b1c19]">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#194121]/10 flex items-center justify-center">
                <Share className="h-4 w-4 text-[#194121]" />
              </div>
              <p>
                {lang === 'el' ? (
                  <>Tap <strong>Share</strong> <span className="inline-block align-middle">⬆</span> then <strong>"Add to Home Screen"</strong></>
                ) : (
                  <>Tap <strong>Share</strong> <span className="inline-block align-middle">⬆</span> then <strong>"Add to Home Screen"</strong></>
                )}
              </p>
            </div>
          </div>
        ) : (
          /* Android / Desktop install button */
          <button
            onClick={handleInstall}
            className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #194121 0%, #305936 100%)' }}
          >
            <Download className="h-4 w-4" />
            {lang === 'el' ? 'Εγκατάσταση' : 'Install'}
          </button>
        )}

        <button
          onClick={handleDismiss}
          className="mt-2 w-full text-center text-xs text-[#606659] hover:text-[#194121] transition-colors py-1"
        >
          {lang === 'el' ? 'Όχι τώρα' : 'Not now'}
        </button>
      </div>
    </div>
  );
}
