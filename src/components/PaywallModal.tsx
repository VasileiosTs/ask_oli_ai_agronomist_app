import { X } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';

interface Props { isOpen: boolean; onClose: () => void; }

export default function PaywallModal({ isOpen, onClose }: Props) {
  const { t } = useLanguage();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl">
        <button onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-muted hover:bg-background hover:text-foreground transition-colors">
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6 text-center">
          <h2 className="mb-2 text-2xl font-bold text-foreground">{t.paywallTitle}</h2>
          <p className="text-sm text-muted">{t.paywallBody}</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => console.log('monthly checkout')}
            className="group flex w-full items-center justify-between rounded-xl border border-border bg-background p-4 transition-all hover:border-primary hover:ring-1 hover:ring-primary">
            <div>
              <p className="font-semibold text-foreground">{t.monthlyPlan}</p>
              <p className="text-sm text-muted">{t.unlimitedMessages}</p>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-foreground">{t.monthly}</span>
            </div>
          </button>

          <button
            onClick={() => console.log('yearly checkout')}
            className="relative flex w-full items-center justify-between rounded-xl border-2 border-primary bg-primary/5 p-4 transition-all hover:bg-primary/10">
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

        <p className="mt-4 text-center text-xs text-muted">{t.cancelAnytime}</p>
      </div>
    </div>
  );
}
