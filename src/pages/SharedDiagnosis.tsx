import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { AlertTriangle } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { useLanguage } from '../lib/LanguageContext';

const SEVERITY: Record<string, { el: string; en: string; color: string; bg: string }> = {
  low:    { el: 'Χαμηλή σοβαρότητα', en: 'Low severity',    color: '#166534', bg: '#dcfce7' },
  medium: { el: 'Μέτρια σοβαρότητα', en: 'Medium severity',  color: '#92400e', bg: '#fef3c7' },
  high:   { el: 'Υψηλή σοβαρότητα',  en: 'High severity',    color: '#991b1b', bg: '#fee2e2' },
};

const SER = `Georgia,'Times New Roman',serif`;
const SAN = `-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;
const TERRA = '#C4521A';
const GREEN = '#194121';
const CREAM = '#F0EDE5';
const BORDER = '#DDD6CB';
const TEXT = '#3D3830';
const MUTED = '#888077';
const HEADER_TEXT = '#F5EFE6';

const isValidUUID = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

interface SharedDiagnosisData {
  share_id?: string;
  legacy_intervention_id?: string;
  problem?: string;
  diagnosis?: string;
  cause?: string;
  crop_type?: string;
  severity?: string;
  product_applied?: string;
  product?: string;
  dosage?: string;
  application_method?: string;
  organic_treatments?: string[];
  chemical_treatments?: string[];
  notes?: string;
  created_at?: string;
}

export default function SharedDiagnosis() {
  const { shareId } = useParams();
  const { lang } = useLanguage();
  const [data, setData] = useState<SharedDiagnosisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNetworkError, setIsNetworkError] = useState(false);

  useEffect(() => {
    if (!shareId || !isValidUUID(shareId)) { setLoading(false); return; }
    (async () => {
      try {
        const { data: d1, error: e1 } = await supabase
          .from('safe_shared_diagnoses').select('*').eq('share_id', shareId).maybeSingle();
        if (e1) throw e1;
        if (d1) { setData(d1); setLoading(false); return; }
        const { data: d2, error: e2 } = await supabase
          .from('safe_shared_diagnoses').select('*').eq('legacy_intervention_id', shareId).maybeSingle();
        if (e2) throw e2;
        setData(d2 ?? null);
      } catch (err) {
        console.error('SharedDiagnosis fetch error:', err);
        setIsNetworkError(true);
      }
      setLoading(false);
    })();
  }, [shareId]);

  // Inject dynamic OG meta tags so WhatsApp/Telegram show the card image
  useEffect(() => {
    if (!data || !shareId) return;
    const origin = window.location.origin;
    // Use the static PNG — SVG is not supported by LinkedIn/Facebook/WhatsApp og:image.
    // The Supabase og-image edge function returns SVG which is ignored by all major crawlers.
    // The middleware.ts intercepts bot requests before they reach the SPA anyway.
    const ogImageUrl = `${origin}/og-image-el.png`;
    const title = `${data.problem || data.diagnosis || 'Διάγνωση'} — ${data.crop_type || 'Καλλιέργεια'} | Oli`;
    const description = data.cause
      ? `Αιτία: ${data.cause}. Διαγνώστηκε με Oli — AI γεωπόνος.`
      : 'Diagnosed with Oli — AI agronomist for farmers worldwide.';

    const setMeta = (property: string, content: string) => {
      let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('property', property);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    document.title = title;
    setMeta('og:title', title);
    setMeta('og:description', description);
    setMeta('og:image', ogImageUrl);
    setMeta('og:image:type', 'image/png');
    setMeta('og:image:width', '1200');
    setMeta('og:image:height', '630');
    setMeta('og:url', `${origin}/d/${shareId}`);
    setMeta('og:type', 'article');

    let twitterCard = document.querySelector('meta[name="twitter:card"]') as HTMLMetaElement;
    if (!twitterCard) {
      twitterCard = document.createElement('meta');
      twitterCard.setAttribute('name', 'twitter:card');
      document.head.appendChild(twitterCard);
    }
    twitterCard.setAttribute('content', 'summary_large_image');

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', `${origin}/d/${shareId}`);

    const existingLd = document.querySelector('script[data-oli-ld]');
    if (existingLd) existingLd.remove();
    const ldScript = document.createElement('script');
    ldScript.type = 'application/ld+json';
    ldScript.setAttribute('data-oli-ld', 'true');
    ldScript.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title,
      description,
      image: ogImageUrl,
      url: `${origin}/d/${shareId}`,
      author: { '@type': 'Organization', name: 'Oli — AI Agronomist', url: origin },
      publisher: {
        '@type': 'Organization',
        name: 'Oli',
        logo: { '@type': 'ImageObject', url: `${origin}/favicon-512.png` },
      },
      about: {
        '@type': 'Thing',
        name: data.crop_type || 'Crop',
        description: `${data.problem || 'Crop issue'} — ${data.cause || 'AI diagnosis'}`,
      },
      inLanguage: lang,
    });
    document.head.appendChild(ldScript);
    return () => { document.querySelector('script[data-oli-ld]')?.remove(); };
  }, [data, shareId, lang]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex min-h-[100dvh] items-center justify-center" style={{ background: CREAM }}>
      <LoadingSpinner />
    </div>
  );

  // ── Network error ──────────────────────────────────────────────────────────
  if (isNetworkError) return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center p-6 text-center" style={{ background: CREAM }}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
        style={{ background: `${TERRA}18` }}>
        <AlertTriangle className="h-7 w-7" style={{ color: TERRA }} />
      </div>
      <h1 className="mb-2 text-lg font-semibold" style={{ color: TEXT }}>
        {lang === 'el' ? 'Σφάλμα σύνδεσης' : 'Connection error'}
      </h1>
      <p className="mb-6 text-sm" style={{ color: MUTED }}>
        {lang === 'el'
          ? 'Δεν ήταν δυνατή η φόρτωση. Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.'
          : 'Could not load. Check your connection and try again.'}
      </p>
      <button
        onClick={() => window.location.reload()}
        className="rounded-full px-6 py-2.5 text-sm font-semibold text-white"
        style={{ background: GREEN }}>
        {lang === 'el' ? 'Δοκίμασε ξανά' : 'Try again'}
      </button>
    </div>
  );

  // ── Not found ──────────────────────────────────────────────────────────────
  if (!data) return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center p-6 text-center" style={{ background: CREAM }}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
        style={{ background: `${GREEN}12` }}>
        <span style={{ fontSize: 28 }}>🌿</span>
      </div>
      <h1 className="mb-2 text-lg font-semibold" style={{ color: TEXT, fontFamily: SER, fontStyle: 'italic' }}>
        {lang === 'el' ? 'Δεν βρέθηκε διάγνωση' : 'Diagnosis not found'}
      </h1>
      <p className="mb-6 text-sm" style={{ color: MUTED }}>
        {lang === 'el' ? 'Ο σύνδεσμος δεν είναι έγκυρος ή έχει λήξει.' : 'The link is invalid or has expired.'}
      </p>
      <Link to="/"
        className="rounded-full px-6 py-2.5 text-sm font-semibold text-white"
        style={{ background: GREEN }}>
        {lang === 'el' ? 'Δοκίμασε το Oli' : 'Try Oli'}
      </Link>
    </div>
  );

  // ── Data ───────────────────────────────────────────────────────────────────
  const problem = data.problem || data.diagnosis || (lang === 'el' ? 'Άγνωστο πρόβλημα' : 'Unknown problem');
  const product = data.product_applied || data.product || '';
  const organic: string[] = Array.isArray(data.organic_treatments) ? data.organic_treatments : [];
  const chemical: string[] = Array.isArray(data.chemical_treatments) ? data.chemical_treatments : [];
  const sev = data.severity ? SEVERITY[data.severity] : null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] pb-16" style={{ background: CREAM }}>

      {/* ── Terracotta header ── */}
      <div style={{ background: TERRA }}>
        {/* Top bar: wordmark + label */}
        <div className="flex items-center justify-between px-5 py-3">
          <span style={{ fontFamily: SER, fontStyle: 'italic', fontSize: 16, color: HEADER_TEXT, letterSpacing: '0.01em' }}>
            · Oli
          </span>
          <span style={{ fontFamily: SAN, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: HEADER_TEXT, opacity: 0.65 }}>
            {lang === 'el' ? 'AI ΔΙΑΓΝΩΣΗ' : 'AI DIAGNOSIS'}
          </span>
        </div>

        {/* Headline block */}
        <div className="px-5 pb-8 pt-1">
          {data.crop_type && (
            <p style={{ fontFamily: SAN, fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', color: HEADER_TEXT, opacity: 0.60, marginBottom: 10 }}>
              {data.crop_type}
            </p>
          )}
          <h1 style={{ fontFamily: SER, fontStyle: 'italic', fontSize: 26, lineHeight: 1.28, color: HEADER_TEXT, margin: 0, letterSpacing: '-0.01em' }}>
            {problem}
          </h1>
          {data.cause && (
            <p style={{ fontFamily: SAN, fontSize: 14, color: HEADER_TEXT, opacity: 0.72, marginTop: 8, lineHeight: 1.5 }}>
              {lang === 'el' ? 'Αιτία: ' : 'Cause: '}{data.cause}
            </p>
          )}
          {sev && (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
              style={{ background: sev.bg, color: sev.color }}>
              <AlertTriangle className="h-3 w-3" />
              {lang === 'el' ? sev.el : sev.en}
            </span>
          )}
        </div>
      </div>

      {/* ── Content cards ── */}
      <main className="mx-auto max-w-lg px-4 pt-4 space-y-3">

        {/* Treatment details */}
        {(product || data.dosage || data.application_method) && (
          <div className="rounded-2xl bg-white px-5 py-4" style={{ border: `1px solid ${BORDER}` }}>
            <p style={{ fontFamily: SAN, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: MUTED, marginBottom: 12 }}>
              {lang === 'el' ? 'Αντιμετώπιση' : 'Treatment'}
            </p>
            <div className="space-y-3 text-sm">
              {product && (
                <div className="flex justify-between gap-4">
                  <span style={{ color: MUTED, fontFamily: SAN }}>{lang === 'el' ? 'Προϊόν' : 'Product'}</span>
                  <span className="text-right font-medium" style={{ color: TEXT, fontFamily: SAN, maxWidth: '60%' }}>{product}</span>
                </div>
              )}
              {data.dosage && (
                <div className="flex justify-between gap-4">
                  <span style={{ color: MUTED, fontFamily: SAN }}>{lang === 'el' ? 'Δοσολογία' : 'Dosage'}</span>
                  <span className="text-right font-medium" style={{ color: TEXT, fontFamily: SAN, maxWidth: '60%' }}>{data.dosage}</span>
                </div>
              )}
              {data.application_method && (
                <div className="flex justify-between gap-4">
                  <span style={{ color: MUTED, fontFamily: SAN }}>{lang === 'el' ? 'Εφαρμογή' : 'Application'}</span>
                  <span className="text-right font-medium" style={{ color: TEXT, fontFamily: SAN, maxWidth: '60%' }}>{data.application_method}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Organic options */}
        {organic.length > 0 && (
          <div className="rounded-2xl bg-white px-5 py-4" style={{ border: `1px solid ${BORDER}`, borderLeft: `3px solid ${GREEN}` }}>
            <p style={{ fontFamily: SAN, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: GREEN, marginBottom: 10 }}>
              {lang === 'el' ? 'Βιολογικές επιλογές' : 'Organic options'}
            </p>
            <ul className="space-y-2">
              {organic.map((t, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: TEXT, fontFamily: SAN }}>
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: GREEN }} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Chemical options */}
        {chemical.length > 0 && (
          <div className="rounded-2xl bg-white px-5 py-4" style={{ border: `1px solid ${BORDER}`, borderLeft: '3px solid #3b82f6' }}>
            <p style={{ fontFamily: SAN, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#2563eb', marginBottom: 10 }}>
              {lang === 'el' ? 'Χημικές επιλογές' : 'Chemical options'}
            </p>
            <ul className="space-y-2">
              {chemical.map((t, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: TEXT, fontFamily: SAN }}>
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                  {t}
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-center gap-1.5 border-t pt-3 text-xs"
              style={{ borderColor: BORDER, color: '#92400e', fontFamily: SAN }}>
              <span>⚠</span>
              {lang === 'el'
                ? 'Ελέγξτε τοπικές άδειες και κανονισμούς πριν εφαρμόσετε χημικά σκευάσματα.'
                : 'Always check local regulations and product registrations before applying chemical treatments.'}
            </p>
          </div>
        )}

        {/* Acquisition CTA */}
        <div className="rounded-2xl bg-white px-5 py-5" style={{ border: `1px solid ${BORDER}` }}>
          <h2 className="mb-1 text-base font-semibold" style={{ color: TEXT, fontFamily: SAN }}>
            {lang === 'el' ? 'Έχεις το ίδιο πρόβλημα;' : 'Having the same problem?'}
          </h2>
          <p className="mb-4 text-sm" style={{ color: MUTED, fontFamily: SAN, lineHeight: 1.55 }}>
            {lang === 'el'
              ? 'Ο Oli διαγνώσκει προβλήματα καλλιεργειών από φωτογραφία σε δευτερόλεπτα. Δωρεάν για τις πρώτες 20 ερωτήσεις.'
              : 'Oli diagnoses crop problems from a photo in seconds. Free for the first 20 questions.'}
          </p>
          <Link
            to={`/auth?ref=${shareId && isValidUUID(shareId) ? shareId : ''}`}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: GREEN }}>
            {lang === 'el' ? 'Δοκίμασε το Oli δωρεάν →' : 'Try Oli for free →'}
          </Link>
        </div>

        {/* Trust signals */}
        <div className="flex items-center justify-center gap-5 pb-2 text-xs" style={{ color: MUTED, fontFamily: SAN }}>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: GREEN }} />
            AI-powered
          </span>
          <span>{lang === 'el' ? '20 δωρεάν ερωτήσεις/μήνα' : 'Free 20 questions/mo'}</span>
          <span>{lang === 'el' ? 'Χωρίς κάρτα' : 'No card needed'}</span>
        </div>
        <p className="pb-2 text-center text-xs" style={{ color: MUTED, fontFamily: SAN }}>
          {lang === 'el' ? 'Διαγνώστηκε από Oli · AI Γεωπόνος' : 'Diagnosed by Oli · AI Agronomist'}
        </p>

      </main>
    </div>
  );
}
