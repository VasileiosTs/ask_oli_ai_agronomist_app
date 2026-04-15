import { useState } from 'react';
import { Gift, Loader2, Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../lib/LanguageContext';

interface Props {
  onSuccess?: () => void;
}

type RedeemError =
  | 'auth_required' | 'user_not_found' | 'invalid_format'
  | 'invalid_code' | 'expired' | 'exhausted' | 'already_redeemed' | 'rate_limited'
  | 'network';

function errorMessage(err: RedeemError, lang: string): string {
  const msgs: Record<RedeemError, Record<string, string>> = {
    auth_required: {
      en: 'Please sign in first.',
      el: 'Παρακαλώ συνδεθείτε πρώτα.',
    },
    user_not_found: {
      en: 'Account not found.',
      el: 'Ο λογαριασμός δεν βρέθηκε.',
    },
    invalid_format: {
      en: 'Code format is not valid.',
      el: 'Μη έγκυρη μορφή κωδικού.',
    },
    invalid_code: {
      en: 'This code does not exist.',
      el: 'Αυτός ο κωδικός δεν υπάρχει.',
    },
    expired: {
      en: 'This code has expired.',
      el: 'Ο κωδικός έχει λήξει.',
    },
    exhausted: {
      en: 'This code has already been fully redeemed.',
      el: 'Ο κωδικός έχει εξαντληθεί.',
    },
    already_redeemed: {
      en: 'You have already used this code.',
      el: 'Έχετε ήδη χρησιμοποιήσει αυτόν τον κωδικό.',
    },
    rate_limited: {
      en: 'Too many attempts. Please try again in an hour.',
      el: 'Πάρα πολλές προσπάθειες. Δοκιμάστε ξανά σε μία ώρα.',
    },
    network: {
      en: 'Network error. Please try again.',
      el: 'Σφάλμα δικτύου. Δοκιμάστε ξανά.',
    },
  };
  return msgs[err][lang] ?? msgs[err].en;
}

export default function PromoCodeRedeem({ onSuccess }: Props) {
  const { lang } = useLanguage();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ tier: string; until: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (loading) return;
    const trimmed = code.trim();
    if (trimmed.length < 3) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc('redeem_promo_code', { p_code: trimmed });
      if (rpcErr) {
        setError(errorMessage('network', lang));
      } else if (data && typeof data === 'object' && 'ok' in data) {
        const result = data as { ok: boolean; error?: RedeemError; tier?: string; granted_until?: string };
        if (result.ok && result.tier && result.granted_until) {
          setSuccess({ tier: result.tier, until: result.granted_until });
          setCode('');
          onSuccess?.();
        } else {
          setError(errorMessage((result.error ?? 'invalid_code') as RedeemError, lang));
        }
      } else {
        setError(errorMessage('network', lang));
      }
    } catch {
      setError(errorMessage('network', lang));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    const untilDate = new Date(success.until).toLocaleDateString(lang === 'el' ? 'el-GR' : 'en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    return (
      <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
            <Check className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground">
              {lang === 'el' ? 'Ενεργοποιήθηκε!' : 'Activated!'}
            </p>
            <p className="text-sm text-muted">
              {lang === 'el'
                ? `${success.tier.toUpperCase()} μέχρι ${untilDate}`
                : `${success.tier.toUpperCase()} until ${untilDate}`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <Gift className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">
          {lang === 'el' ? 'Έχετε κωδικό προσφοράς;' : 'Have a promo code?'}
        </h3>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder={lang === 'el' ? 'ΚΩΔΙΚΟΣ' : 'CODE'}
          maxLength={40}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="flex-1 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm font-mono tracking-wider text-foreground outline-none focus:border-primary"
          disabled={loading}
        />
        <button
          onClick={submit}
          disabled={loading || code.trim().length < 3}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (lang === 'el' ? 'Εξαργύρωση' : 'Redeem')}
        </button>
      </div>
      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
          <X className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
