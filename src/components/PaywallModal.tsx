import { X, Crown } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Events, trackEvent } from '../lib/analytics';
import { SUPPORT_EMAIL } from '../../shared/subscription';

interface Props { isOpen: boolean; onClose: () => void; }

export default function PaywallModal({ isOpen, onClose }: Props) {
  const { t, lang } = useLanguage();
  const { user, profile } = useAuth();
  const [selected, setSelected] = useState<'monthly' | 'yearly' | null>(null);
  const [submitting, setSubmitting] = useState<'monthly' | 'yearly' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  if (!isOpen) return null;

  const helpText = lang === 'el'
    ? 'Θα ειδοποιηθεί η ομάδα μας και θα επικοινωνήσει μαζί σου.'
    : 'Our team will be notified and reach out to you.';

  const openEmailFallback = (plan: 'monthly' | 'yearly') => {
    const planLabel = plan === 'monthly' ? t.monthlyPlan : t.yearlyPlan;
    const body = [
      lang === 'el'
        ? 'Γεια σας, ενδιαφέρομαι για αναβάθμιση στο Oli Pro.'
        : 'Hi, I am interested in upgrading to Oli Pro.',
      '',
      `Plan: ${planLabel}`,
      `Email: ${user?.email ?? 'unknown'}`,
      `Name: ${typeof profile?.name === 'string' ? profile.name : 'unknown'}`,
      `Current tier: ${typeof profile?.tier === 'string' ? profile.tier : 'free'}`,
    ].join('\n');

    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Oli upgrade interest - ${planLabel}`)}&body=${encodeURIComponent(body)}`;
  };

  const handleSelect = async (plan: 'monthly' | 'yearly') => {
    setSelected(plan);
    setSubmitting(plan);
    setNotice(null);
    trackEvent(Events.PAYWALL_UPGRADE_CLICK, {
      plan,
      source: 'paywall_modal',
      currentTier: profile?.tier ?? 'free',
    });

    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          mode: 'upgrade_interest',
          email: user?.email ?? '',
          name: typeof profile?.name === 'string' ? profile.name : '',
          currentTier: typeof profile?.tier === 'string' ? profile.tier : 'free',
          requestedPlan: plan,
          lang,
        },
      });

      if (error || !data?.sent) {
        openEmailFallback(plan);
        setNotice(
          lang === 'el'
            ? 'Άνοιξε το email σου για να ολοκληρώσεις το αίτημα αναβάθμισης.'
            : 'Your email app has been opened to finish the upgrade request.',
        );
        return;
      }

      setNotice(
        lang === 'el'
          ? 'Το αίτημα αναβάθμισης στάλθηκε. Η ομάδα μας θα επικοινωνήσει μαζί σου σύντομα.'
          : 'Your upgrade request was sent. Our team will reach out shortly.',
      );
    } catch (error) {
      console.error('Upgrade interest request failed:', error);
      openEmailFallback(plan);
      setNotice(
        lang === 'el'
          ? 'Δεν ήταν δυνατή η αυτόματη αποστολή. Άνοιξε το email σου για να συνεχίσεις.'
          : 'Automatic sending was unavailable, so your email app was opened instead.',
      );
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl">
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
            disabled={submitting !== null}
            className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition-colors ${
              selected === 'monthly'
                ? 'border-primary bg-primary/10'
                : 'border-border bg-background hover:border-primary/50'
            } ${submitting !== null ? 'cursor-wait opacity-70' : ''}`}
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
            disabled={submitting !== null}
            className={`relative flex w-full items-center justify-between rounded-xl border p-4 text-left transition-colors ${
              selected === 'yearly'
                ? 'border-primary bg-primary/10'
                : 'border-border bg-background hover:border-primary/50'
            } ${submitting !== null ? 'cursor-wait opacity-70' : ''}`}
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
          <p className="text-sm font-medium text-primary">{helpText}</p>
        </div>

        {notice && (
          <p className="mt-3 rounded-xl bg-background px-3 py-2 text-center text-xs text-muted">
            {notice}
          </p>
        )}

        <p className="mt-3 text-center text-xs text-muted">{t.cancelAnytime}</p>
      </div>
    </div>
  );
}
