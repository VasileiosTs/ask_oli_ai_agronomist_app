import { X, Crown, Check, Sprout, Briefcase, Building2 } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Events, trackEvent } from '../lib/analytics';
import { SUPPORT_EMAIL } from '../../shared/subscription';

interface Props { isOpen: boolean; onClose: () => void; }

const TIERS = [
  {
    key: 'free' as const,
    icon: Sprout,
    color: 'text-muted',
    borderActive: 'border-muted',
    features: { en: ['20 messages/month', '3 fields', '7-day history', '1 report/month'], el: ['20 μηνύματα/μήνα', '3 χωράφια', 'Ιστορικό 7 ημερών', '1 αναφορά/μήνα'] },
    price: null,
    current: true,
  },
  {
    key: 'pro' as const,
    icon: Crown,
    color: 'text-primary',
    borderActive: 'border-primary',
    features: { en: ['Unlimited messages', 'Unlimited fields', 'Full history', 'Unlimited reports'], el: ['Απεριόριστα μηνύματα', 'Απεριόριστα χωράφια', 'Πλήρες ιστορικό', 'Απεριόριστες αναφορές'] },
    price: { en: '€8.99/month', el: '€8,99/μήνα' },
  },
  {
    key: 'agronomist' as const,
    icon: Briefcase,
    color: 'text-amber-500',
    borderActive: 'border-amber-500',
    features: { en: ['Everything in Pro', 'Branded reports', 'Client management', 'Priority support'], el: ['Όλα του Pro', 'Επώνυμες αναφορές', 'Διαχείριση πελατών', 'Προτεραιότητα υποστήριξης'] },
    price: { en: '€49/month', el: '€49/μήνα' },
  },
  {
    key: 'enterprise' as const,
    icon: Building2,
    color: 'text-blue-500',
    borderActive: 'border-blue-500',
    features: { en: ['Custom integrations', 'Dedicated support', 'SLA guarantee', 'Volume pricing'], el: ['Προσαρμοσμένες ενσωματώσεις', 'Αφοσιωμένη υποστήριξη', 'Εγγύηση SLA', 'Τιμές όγκου'] },
    price: null,
    enterprise: true,
  },
] as const;

export default function PaywallModal({ isOpen, onClose }: Props) {
  const { user, profile } = useAuth();
  const { lang } = useLanguage();
  const [selected, setSelected] = useState<string | null>(null);
  const [enterpriseEmail, setEnterpriseEmail] = useState('');
  const [enterpriseSent, setEnterpriseSent] = useState(false);
  const [submittingTier, setSubmittingTier] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  if (!isOpen) return null;

  const l = lang === 'el' ? 'el' : 'en';
  const labels = {
    title: { en: 'Choose Your Plan', el: 'Επιλέξτε Πλάνο' },
    current: { en: 'Current', el: 'Τρέχον' },
    upgrade: { en: 'Upgrade', el: 'Αναβάθμιση' },
    comingSoon: { en: 'Coming soon', el: 'Σύντομα' },
    requestQuote: { en: 'Request a Quote', el: 'Ζητήστε Προσφορά' },
    enterEmail: { en: 'Your email', el: 'Το email σας' },
    send: { en: 'Send', el: 'Αποστολή' },
    sent: { en: 'We\'ll be in touch!', el: 'Θα επικοινωνήσουμε!' },
    cancel: { en: 'Cancel anytime', el: 'Ακύρωση ανά πάσα στιγμή' },
  };

  const openEmailFallback = (tier: string, emailOverride?: string) => {
    const body = [
      lang === 'el'
        ? 'Γεια σας, ενδιαφέρομαι για αναβάθμιση στο Oli.'
        : 'Hi, I am interested in upgrading to Oli.',
      '',
      `Tier: ${tier}`,
      `Email: ${emailOverride || user?.email || ''}`,
      `Name: ${typeof profile?.name === 'string' ? profile.name : ''}`,
      `Current tier: ${typeof profile?.tier === 'string' ? profile.tier : 'free'}`,
    ].join('\n');

    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Oli upgrade interest - ${tier}`)}&body=${encodeURIComponent(body)}`;
  };

  const submitInterest = async (tier: string, emailOverride?: string) => {
    setSubmittingTier(tier);
    setNotice(null);
    trackEvent(Events.PAYWALL_UPGRADE_CLICK, {
      tier,
      source: 'paywall_modal',
      currentTier: profile?.tier ?? 'free',
    });

    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          mode: 'upgrade_interest',
          email: emailOverride || user?.email || '',
          name: typeof profile?.name === 'string' ? profile.name : '',
          currentTier: typeof profile?.tier === 'string' ? profile.tier : 'free',
          requestedTier: tier,
          requestedPlan: tier,
          lang,
        },
      });

      if (error || !data?.sent) {
        openEmailFallback(tier, emailOverride);
        setNotice(
          lang === 'el'
            ? 'Άνοιξε το email σου για να ολοκληρώσεις το αίτημα αναβάθμισης.'
            : 'Your email app has been opened to finish the upgrade request.',
        );
        return false;
      }

      setNotice(
        lang === 'el'
          ? 'Το αίτημα αναβάθμισης στάλθηκε. Η ομάδα μας θα επικοινωνήσει μαζί σου σύντομα.'
          : 'Your upgrade request was sent. Our team will reach out shortly.',
      );
      return true;
    } catch {
      openEmailFallback(tier, emailOverride);
      setNotice(
        lang === 'el'
          ? 'Δεν ήταν δυνατή η αυτόματη αποστολή. Άνοιξε το email σου για να συνεχίσεις.'
          : 'Automatic sending was unavailable, so your email app was opened instead.',
      );
      return false;
    } finally {
      setSubmittingTier(null);
    }
  };

  const handleEnterprise = async () => {
    if (!enterpriseEmail.trim()) return;
    const sent = await submitInterest('enterprise', enterpriseEmail.trim());
    if (sent) {
      setEnterpriseSent(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-2xl">
        <button onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1 text-muted hover:bg-background hover:text-foreground transition-colors z-10">
          <X className="h-5 w-5" />
        </button>

        <h2 className="mb-4 text-center text-xl font-bold text-foreground">{labels.title[l]}</h2>

        <div className="space-y-3">
          {TIERS.map((tier) => {
            const Icon = tier.icon;
            const isSelected = selected === tier.key;
            const isCurrent = 'current' in tier;
            const isEnterprise = 'enterprise' in tier;
            return (
              <button
                key={tier.key}
                onClick={() => {
                  setSelected(tier.key);
                  setNotice(null);
                }}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  isSelected ? `${tier.borderActive} bg-primary/5` : 'border-border bg-background hover:border-primary/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-5 w-5 flex-shrink-0 ${tier.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground capitalize">{tier.key}</span>
                      {isCurrent && (
                        <span className="rounded-full bg-muted/20 px-2 py-0.5 text-[10px] font-medium text-muted">
                          {labels.current[l]}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      {tier.features[l].map((f) => (
                        <span key={f} className="flex items-center gap-1 text-xs text-muted">
                          <Check className="h-3 w-3 text-primary" />
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {tier.price ? (
                      <span className="text-sm font-bold text-foreground">{tier.price[l]}</span>
                    ) : isEnterprise ? (
                      <span className="text-xs font-medium text-blue-500">{labels.requestQuote[l]}</span>
                    ) : (
                      <span className="text-xs text-muted">{labels.current[l]}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {notice && (
          <p className="mt-3 rounded-xl bg-background px-3 py-2 text-center text-xs text-muted">
            {notice}
          </p>
        )}

        {/* Enterprise email form */}
        {selected === 'enterprise' && (
          <div className="mt-3 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 animate-fade-in">
            {enterpriseSent ? (
              <p className="text-center text-sm font-medium text-blue-500">{labels.sent[l]}</p>
            ) : (
              <div className="flex gap-2">
                <input
                  type="email"
                  value={enterpriseEmail}
                  onChange={(e) => setEnterpriseEmail(e.target.value)}
                  placeholder={labels.enterEmail[l]}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleEnterprise}
                  disabled={!enterpriseEmail.trim()}
                  className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
                >
                  {labels.send[l]}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Upgrade button for pro/agronomist */}
        {(selected === 'pro' || selected === 'agronomist') && (
          <div className="mt-3 rounded-xl bg-primary/10 p-3 text-center">
            <button
              onClick={() => void submitInterest(selected)}
              disabled={submittingTier !== null}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {submittingTier === selected ? labels.send[l] : labels.upgrade[l]}
            </button>
          </div>
        )}

        <p className="mt-3 text-center text-xs text-muted">{labels.cancel[l]}</p>
      </div>
    </div>
  );
}
