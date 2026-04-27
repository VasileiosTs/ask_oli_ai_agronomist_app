import { X, Check, Sprout, Crown, Briefcase, Building2 } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Events, trackEvent } from '../lib/analytics';
import { SUPPORT_EMAIL } from '../../shared/subscription';

interface Props { isOpen: boolean; onClose: () => void; }

// ── Tier definitions ──────────────────────────────────────────────────────────
// Each tier is honest about what it includes right now.
// No "coming soon" items — every feature listed is shipped.

const TIERS = (lang: string, currentTier?: string | null) => {
  const l = lang === 'el' ? 'el' : 'en';
  const isCurrent = (key: string) =>
    (currentTier ?? 'free') === key || (!currentTier && key === 'free');

  return [
    {
      key: 'free',
      icon: Sprout,
      iconColor: 'text-[#606659]',
      name: { en: 'Starter', el: 'Starter' },
      price: { en: '€0 / month', el: '€0 / μήνα' },
      note: { en: 'For hobby gardeners & curious growers', el: 'Για ερασιτέχνες κηπουρούς και νέους χρήστες' },
      features: {
        en: [
          '20 questions per month',
          'Photo disease diagnosis',
          'Treatment plan with dosages',
          '7-day intervention history',
          '1 field report per month',
          'Up to 3 fields',
        ],
        el: [
          '20 ερωτήσεις τον μήνα',
          'Διάγνωση ασθένειας από φωτογραφία',
          'Πλάνο θεραπείας με δόσεις',
          '7 ημέρες ιστορικό παρεμβάσεων',
          '1 αναφορά χωραφιού τον μήνα',
          'Έως 3 χωράφια',
        ],
      },
      cta: null,
      contactOnly: false,
      isCurrent: isCurrent('free'),
      forRoles: ['farmer', 'hobbyist', 'cooperative', 'enterprise', 'agronomist', ''],
    },
    {
      key: 'pro',
      icon: Crown,
      iconColor: 'text-[#194121]',
      name: { en: 'Pro', el: 'Pro' },
      price: { en: '€49 / year', el: '€49 / χρόνο' },
      note: { en: 'For farmers and growers who depend on their crops', el: 'Για αγρότες και παραγωγούς που εξαρτώνται από τη γη τους' },
      features: {
        en: [
          'Unlimited questions',
          'Unlimited fields + crop memory',
          'Full intervention history',
          'Irrigation & planting calculations',
          'Unlimited field PDF reports',
        ],
        el: [
          'Απεριόριστες ερωτήσεις',
          'Απεριόριστα χωράφια + μνήμη καλλιεργειών',
          'Πλήρες ιστορικό παρεμβάσεων',
          'Υπολογισμοί άρδευσης και φύτευσης',
          'Απεριόριστες PDF αναφορές χωραφιών',
        ],
      },
      cta: { en: 'Upgrade to Pro', el: 'Αναβάθμιση σε Pro' },
      contactOnly: false,
      isCurrent: isCurrent('pro'),
      forRoles: ['farmer', 'hobbyist', ''],
    },
    {
      key: 'agronomist',
      icon: Briefcase,
      iconColor: 'text-amber-600',
      name: { en: 'Master', el: 'Master' },
      price: { en: '€490 / year', el: '€490 / χρόνο' },
      note: { en: 'For agronomists advising multiple clients', el: 'Για γεωπόνους που συμβουλεύουν πελάτες' },
      features: {
        en: [
          'Everything in Pro',
          'Manage unlimited clients',
          'Per-client fields & intervention history',
          'Scientific calculations (ETc, NPK)',
          'Branded PDF reports for clients',
        ],
        el: [
          'Όλα του Pro',
          'Διαχείριση απεριόριστων πελατών',
          'Χωράφια & ιστορικό παρεμβάσεων ανά πελάτη',
          'Επιστημονικοί υπολογισμοί (ETc, NPK)',
          'Επώνυμες PDF αναφορές για πελάτες',
        ],
      },
      cta: { en: 'Upgrade to Master', el: 'Αναβάθμιση σε Master' },
      contactOnly: false,
      isCurrent: isCurrent('agronomist'),
      forRoles: ['agronomist', 'farmer', ''],
    },
    {
      key: 'enterprise',
      icon: Building2,
      iconColor: 'text-slate-600',
      name: { en: 'Enterprise', el: 'Enterprise' },
      price: { en: 'Custom pricing', el: 'Προσαρμοσμένη τιμή' },
      note: { en: 'For cooperatives & agribusinesses managing agronomist teams', el: 'Για συνεταιρισμούς & εταιρείες που διαχειρίζονται γεωπόνους' },
      features: {
        en: [
          'Everything in Master',
          'Multiple seats / team accounts',
          'White-label or co-branded reports',
          'Priority support',
          'Custom integrations on request',
        ],
        el: [
          'Όλα του Master',
          'Πολλαπλοί χρήστες / ομάδα',
          'White-label ή co-branded αναφορές',
          'Προτεραιότητα υποστήριξης',
          'Προσαρμοσμένες ενσωματώσεις κατόπιν αιτήματος',
        ],
      },
      cta: { en: 'Contact us', el: 'Επικοινωνήστε μαζί μας' },
      contactOnly: true,
      isCurrent: isCurrent('enterprise'),
      forRoles: ['cooperative', 'enterprise', ''],
    },
  ];
};

export default function PaywallModal({ isOpen, onClose }: Props) {
  const { user, profile } = useAuth();
  const { lang } = useLanguage();
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const l = lang === 'el' ? 'el' : 'en';
  const currentTier = typeof profile?.tier === 'string' ? profile.tier : 'free';
  const userRole = typeof profile?.role === 'string' ? profile.role : '';
  const tiers = TIERS(lang, currentTier);
  const displayedTiers = tiers;
  const selectedTier = displayedTiers.find(t => t.key === selected);

  const openEmailFallback = (tierKey: string) => {
    const body = [
      lang === 'el'
        ? 'Γεια σας, ενδιαφέρομαι για αναβάθμιση στο Oli.'
        : 'Hi, I am interested in upgrading my Oli account.',
      '',
      `Tier: ${tierKey}`,
      `Email: ${user?.email || ''}`,
      `Name: ${typeof profile?.name === 'string' ? profile.name : ''}`,
      `Current tier: ${currentTier}`,
    ].join('\n');
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Oli upgrade — ${tierKey}`)}&body=${encodeURIComponent(body)}`;
  };

  const handleUpgrade = async (tierKey: string) => {
    if (submitting) return;
    setSubmitting(true);
    setNotice(null);
    trackEvent(Events.PAYWALL_UPGRADE_CLICK, {
      tier: tierKey,
      source: 'paywall_modal',
      currentTier,
    });

    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          mode: 'upgrade_interest',
          email: user?.email || '',
          name: typeof profile?.name === 'string' ? profile.name : '',
          currentTier,
          requestedTier: tierKey,
          requestedPlan: tierKey,
          lang,
        },
      });

      if (error || !data?.sent) {
        openEmailFallback(tierKey);
        setNotice(
          l === 'el'
            ? 'Άνοιξε το email σου για να ολοκληρώσεις το αίτημα.'
            : 'Your email app has been opened to complete the request.',
        );
      } else {
        setSent(tierKey);
      }
    } catch {
      openEmailFallback(tierKey);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full sm:max-w-md max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-border bg-surface shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 bg-surface border-b border-border/50 px-5 pt-5 pb-4 z-10">
          <button
            onClick={onClose}
            aria-label={l === 'el' ? 'Κλείσιμο' : 'Close'}
            className="absolute right-4 top-4 rounded-full p-1.5 text-muted hover:bg-background hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          <h2 className="text-lg font-bold text-foreground pr-8">
            {l === 'el' ? 'Αναβάθμισε τον λογαριασμό σου' : 'Upgrade your account'}
          </h2>
          <p className="text-xs text-muted mt-0.5">
            {l === 'el'
              ? 'Επέλεξε το πλάνο που ταιριάζει στις ανάγκες σου.'
              : 'Choose the plan that fits your needs.'}
          </p>
        </div>

        <div className="px-5 py-4 space-y-3">
          {displayedTiers.map((tier) => {
            const Icon = tier.icon;
            const isSelected = selected === tier.key;
            const wasSent = sent === tier.key;

            return (
              <button
                key={tier.key}
                onClick={() => {
                  if (!tier.isCurrent) {
                    setSelected(isSelected ? null : tier.key);
                    setNotice(null);
                  }
                }}
                disabled={tier.isCurrent}
                className={[
                  'w-full rounded-xl border text-left transition-all',
                  tier.isCurrent
                    ? 'border-border/40 bg-background/40 cursor-default opacity-60'
                    : isSelected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-background hover:border-primary/40 cursor-pointer',
                ].join(' ')}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className={`h-4 w-4 flex-shrink-0 ${tier.iconColor}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground">{tier.name[l]}</span>
                          {tier.isCurrent && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wide">
                              {l === 'el' ? 'Τρέχον' : 'Current'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted mt-0.5">{tier.note[l]}</p>
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className="text-sm font-bold text-foreground whitespace-nowrap">{tier.price[l]}</span>
                    </div>
                  </div>

                  {/* Features — always visible */}
                  <ul className="mt-3 space-y-1.5 pl-6">
                    {tier.features[l].map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-muted">
                        <Check className="h-3 w-3 text-primary flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* CTA — shown when selected */}
                  {isSelected && tier.cta && (
                    <div className="mt-4 animate-fade-in">
                      {tier.contactOnly ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); openEmailFallback(tier.key); }}
                          className="w-full py-2.5 rounded-full text-sm font-semibold bg-slate-700 text-white hover:opacity-90 transition-opacity"
                        >
                          {tier.cta[l]}
                        </button>
                      ) : wasSent ? (
                        <p className="text-center text-sm font-medium text-primary py-2">
                          {l === 'el' ? '✓ Το αίτημά σου στάλθηκε. Θα επικοινωνήσουμε σύντομα.' : '✓ Request sent. We\'ll be in touch shortly.'}
                        </p>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); void handleUpgrade(tier.key); }}
                          disabled={submitting}
                          className="w-full py-2.5 rounded-full text-sm font-semibold bg-primary text-white hover:opacity-90 disabled:opacity-60 transition-opacity"
                        >
                          {submitting ? (l === 'el' ? 'Αποστολή...' : 'Sending...') : tier.cta[l]}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {notice && (
          <p className="mx-5 mb-4 rounded-xl bg-background px-3 py-2.5 text-center text-xs text-muted border border-border">
            {notice}
          </p>
        )}

        <div className="px-5 pb-5 pt-1">
          <p className="text-center text-xs text-muted">
            {l === 'el'
              ? 'Ακύρωση ανά πάσα στιγμή · Χωρίς κρυφές χρεώσεις'
              : 'Cancel anytime · No hidden charges'}
          </p>
        </div>
      </div>
    </div>
  );
}
