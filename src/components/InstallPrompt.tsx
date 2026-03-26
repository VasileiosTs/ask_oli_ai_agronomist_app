import { useState, useEffect, useRef } from 'react';
import { X, Download, Share } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'oli_install_dismissed';
const DISMISS_DAYS = 7;

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
  const daysSince = (Date.now() - ts) / (1000 * 60 * 60 * 24);
  return daysSince < DISMISS_DAYS;
}

export default function InstallPrompt() {
  const { lang } = useLanguage();
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Don't show if already installed or recently dismissed
    if (isInstalledPwa() || wasDismissed()) return;

    // iOS Safari: show custom instructions
    if (isIosSafari()) {
      const timer = setTimeout(() => {
        setIsIos(true);
        setShow(true);
      }, 30000); // 30 seconds
      return () => clearTimeout(timer);
    }

    // Android / Desktop Chrome / Edge: capture native install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      // Show our custom UI after a delay
      setTimeout(() => setShow(true), 30000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
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
    <div className="fixed bottom-[72px] md:bottom-20 left-4 right-4 z-50 mx-auto max-w-sm animate-slide-up">
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
                  <>Πάτα <strong>Κοινοποίηση</strong> <span className="inline-block align-middle">⬆</span> και μετά <strong>"Προσθήκη στην οθόνη Αφ."</strong></>
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
