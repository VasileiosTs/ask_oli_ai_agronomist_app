import { X, Crown } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { useState } from 'react';

interface Props { isOpen: boolean; onClose: () => void; }

export default function PaywallModal({ isOpen, onClose }: Props) {
  const { t, lang } = useLanguage();
  const [selected, setSelected] = useState<'monthly' | 'yearly' | null>(null);
  if (!isOpen) return null;

  const comingSoon = lang === 'el' ? 'Σύντομα διαθέσιμο' : 'Coming soon';

  const handleSelect = (plan: 'monthly' | 'yearly') => {
    setSelected(plan);
    // TODO: integrate Stripe checkout when ready
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl">
        <button onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-muted hover:bg-background hover:text-foreground transition-colors">
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
            <Crown className="h-6 w-6 text-primary" />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-foreground">{t.paywallTitle}</h2>
          <p className="text-sm text-muted">{t.paywallBody}</p>
        </div>

        <div className="space-y-3">
          {/* Monthly plan */}
          <button
            onClick={() => handleSelect('monthly')}
            className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition-colors ${
              selected === 'monthly'
                ? 'border-primary bg-primary/10'
                : 'border-border bg-background hover:border-primary/50'
            }`}
          >
            <div>
              <p className="font-semibold text-foreground">{t.monthlyPlan}</p>
              <p className="text-sm text-muted">{t.unlimitedMessages}</p>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-foreground">{t.monthly}</span>
            </div>
          </button>

          {/* Yearly plan */}
          <button
            onClick={() => handleSelect('yearly')}
            className={`relative flex w-full items-center justify-between rounded-xl border p-4 text-left transition-colors ${
              selected === 'yearly'
                ? 'border-primary bg-primary/10'
                : 'border-border bg-background hover:border-primary/50'
            }`}
          >
            <div className="absolute -top-3 left-4 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              {t.savings}
            </div>
            <div>
              <p className="font-semibold text-foreground">{t.yearlyPlan}</p>
              <p className="text-sm text-muted">{t.unlimitedMessages}</p>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-foreground">{t.yearly}</span>
            </div>
          </button>
        </div>

        {/* Coming soon notice */}
        <div className="mt-4 rounded-xl bg-primary/10 p-3 text-center">
          <p className="text-sm font-medium text-primary">{comingSoon}</p>
        </div>

        <p className="mt-3 text-center text-xs text-muted">{t.cancelAnytime}</p>
      </div>
    </div>
  );
}
