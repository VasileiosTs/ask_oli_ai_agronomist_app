import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Leaf, AlertTriangle, ChevronRight } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { useLanguage } from '../lib/LanguageContext';

const SEVERITY_BADGE: Record<string, { el: string; en: string; cls: string }> = {
  low:    { el: 'Χαμηλή σοβαρότητα', en: 'Low severity',    cls: 'bg-green-500/10 text-green-400 border-green-500/20' },
  medium: { el: 'Μέτρια σοβαρότητα', en: 'Medium severity',  cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  high:   { el: 'Υψηλή σοβαρότητα',  en: 'High severity',    cls: 'bg-red-500/10   text-red-400   border-red-500/20'   },
};

/** Validate that a string looks like a UUID (v4) */
const isValidUUID = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

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
    const ogImageUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/og-image?id=${shareId}`;
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
    setMeta('og:image:width', '1200');
    setMeta('og:image:height', '630');
    setMeta('og:url', `${origin}/d/${shareId}`);
    setMeta('og:type', 'article');

    // Twitter/X card
    let twitterCard = document.querySelector('meta[name="twitter:card"]') as HTMLMetaElement;
    if (!twitterCard) {
      twitterCard = document.createElement('meta');
      twitterCard.setAttribute('name', 'twitter:card');
      document.head.appendChild(twitterCard);
    }
    twitterCard.setAttribute('content', 'summary_large_image');

    // Canonical URL
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', `${origin}/d/${shareId}`);

    // JSON-LD structured data for rich search results
    const existingLd = document.querySelector('script[data-oli-ld]');
    if (existingLd) existingLd.remove();
    const ldScript = document.createElement('script');
    ldScript.type = 'application/ld+json';
    ldScript.setAttribute('data-oli-ld', 'true');
    ldScript.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title,
      description: description,
      image: ogImageUrl,
      url: `${origin}/d/${shareId}`,
      author: {
        '@type': 'Organization',
        name: 'Oli — AI Agronomist',
        url: origin,
      },
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

    return () => {
      const ld = document.querySelector('script[data-oli-ld]');
      if (ld) ld.remove();
    };
  }, [data, shareId]);

  if (loading) return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#0D1117]">
      <LoadingSpinner />
    </div>
  );

  /* ── Network error ── */
  if (isNetworkError) return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#0D1117] p-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
        <AlertTriangle className="h-7 w-7 text-amber-400" />
      </div>
      <h1 className="mb-2 text-lg font-semibold text-white">{lang === 'el' ? 'Σφάλμα σύνδεσης' : 'Connection error'}</h1>
      <p className="mb-6 text-sm text-[#8B949E]">{lang === 'el' ? 'Δεν ήταν δυνατή η φόρτωση. Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.' : 'Could not load. Check your connection and try again.'}</p>
      <button onClick={() => window.location.reload()} className="rounded-full bg-[#2EA043] px-6 py-2.5 text-sm font-medium text-white">
        {lang === 'el' ? 'Δοκίμασε ξανά' : 'Try again'}
      </button>
    </div>
  );

  /* ── Not found ── */
  if (!data) return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#0D1117] p-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#2EA043]/10">
        <Leaf className="h-7 w-7 text-[#2EA043]" />
      </div>
      <h1 className="mb-2 text-lg font-semibold text-white">{lang === 'el' ? 'Δεν βρέθηκε διάγνωση' : 'Diagnosis not found'}</h1>
      <p className="mb-6 text-sm text-[#8B949E]">{lang === 'el' ? 'Ο σύνδεσμος δεν είναι έγκυρος ή έχει λήξει.' : 'The link is invalid or has expired.'}</p>
      <Link to="/" className="rounded-full bg-[#2EA043] px-6 py-2.5 text-sm font-medium text-white">
        {lang === 'el' ? 'Δοκίμασε το Oli' : 'Try Oli'}
      </Link>
    </div>
  );

  const problem = data.problem || data.diagnosis || (lang === 'el' ? 'Άγνωστο πρόβλημα' : 'Unknown problem');
  const product = data.product_applied || data.product || '';
  const organic: string[] = Array.isArray(data.organic_treatments) ? data.organic_treatments : [];
  const chemical: string[] = Array.isArray(data.chemical_treatments) ? data.chemical_treatments : [];
  const sev = SEVERITY_BADGE[data.severity as string];

  return (
    <div className="min-h-[100dvh] bg-[#0D1117] pb-16 text-white">

      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2EA043]/15">
            <Leaf className="h-4 w-4 text-[#2EA043]" />
          </div>
          <span className="text-sm font-semibold">Oli</span>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-[#8B949E]">
          {lang === 'el' ? 'AI Διάγνωση' : 'AI Diagnosis'}
        </span>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-6 space-y-4">

        {/* Hero card — the diagnosis */}
        <div className="rounded-2xl border border-white/10 bg-[#161C23] p-5">
          <p className="mb-1 text-xs font-medium uppercase tracking-widest text-[#2EA043]">
            {data.crop_type || (lang === 'el' ? 'Καλλιέργεια' : 'Crop')}
          </p>
          <h1 className="text-xl font-semibold leading-snug">{problem}</h1>
          {data.cause && (
            <p className="mt-2 text-sm text-[#8B949E]">{lang === 'el' ? 'Αιτία' : 'Cause'}: {data.cause}</p>
          )}
          {sev && (
            <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${sev.cls}`}>
              <AlertTriangle className="h-3 w-3" />{lang === 'el' ? sev.el : sev.en}
            </span>
          )}
        </div>

        {/* Treatment */}
        {(product || data.dosage || data.application_method) && (
          <div className="rounded-2xl border border-white/10 bg-[#161C23] p-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-[#8B949E]">{lang === 'el' ? 'Αντιμετώπιση' : 'Treatment'}</p>
            <div className="space-y-3 text-sm">
              {product && (
                <div className="flex justify-between">
                  <span className="text-[#8B949E]">{lang === 'el' ? 'Προϊόν' : 'Product'}</span>
                  <span className="font-medium text-right max-w-[60%]">{product}</span>
                </div>
              )}
              {data.dosage && (
                <div className="flex justify-between">
                  <span className="text-[#8B949E]">{lang === 'el' ? 'Δοσολογία' : 'Dosage'}</span>
                  <span className="font-medium text-right max-w-[60%]">{data.dosage}</span>
                </div>
              )}
              {data.application_method && (
                <div className="flex justify-between">
                  <span className="text-[#8B949E]">{lang === 'el' ? 'Εφαρμογή' : 'Application'}</span>
                  <span className="font-medium text-right max-w-[60%]">{data.application_method}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Organic options */}
        {organic.length > 0 && (
          <div className="rounded-2xl border border-[#2EA043]/20 bg-[#2EA043]/5 p-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-[#2EA043]">{lang === 'el' ? 'Βιολογικές επιλογές' : 'Organic options'}</p>
            <ul className="space-y-2">
              {organic.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                  <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#2EA043]" />{t}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Chemical options */}
        {chemical.length > 0 && (
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-blue-400">{lang === 'el' ? 'Χημικές επιλογές' : 'Chemical options'}</p>
            <ul className="space-y-2">
              {chemical.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                  <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-400" />{t}
                </li>
              ))}
            </ul>
            {/* S2: Regulatory disclaimer for chemical treatments */}
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-400/80 border-t border-blue-500/10 pt-3">
              <span>⚠</span>
              {lang === 'el'
                ? 'Ελέγξτε τοπικές άδειες και κανονισμούς πριν εφαρμόσετε χημικά σκευάσματα.'
                : 'Always check local regulations and product registrations before applying chemical treatments.'}
            </p>
          </div>
        )}

        {/* Acquisition CTA — the whole point of this page */}
        <div className="rounded-2xl border border-[#2EA043]/30 bg-[#2EA043]/8 p-5">
          <p className="mb-1 text-base font-semibold">{lang === 'el' ? 'Έχεις το ίδιο πρόβλημα;' : 'Having the same problem?'}</p>
          <p className="mb-4 text-sm text-[#8B949E]">
            {lang === 'el'
              ? 'Ο Oli διαγνώσκει προβλήματα καλλιεργειών από φωτογραφία σε δευτερόλεπτα. Δωρεάν για τους πρώτους 20 ερωτήσεις.'
              : 'Oli diagnoses crop problems from a photo in seconds. Free for the first 20 questions.'}
          </p>
          <Link
            to={`/auth?ref=${shareId && isValidUUID(shareId) ? shareId : ''}`}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#2EA043] py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            {lang === 'el' ? 'Δοκίμασε το Oli δωρεάν' : 'Try Oli for free'}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Social proof + trust signal */}
        <div className="text-center space-y-2 pb-4">
          <div className="flex items-center justify-center gap-4 text-xs text-[#8B949E]">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-[#2EA043] animate-pulse" />
              {lang === 'el' ? 'AI-powered' : 'AI-powered'}
            </span>
            <span>{lang === 'el' ? 'Δωρεάν 20 ερωτήσεις/μήνα' : 'Free 20 questions/mo'}</span>
            <span>{lang === 'el' ? 'Χωρίς κάρτα' : 'No card needed'}</span>
          </div>
          <p className="text-xs text-[#8B949E]">
            {lang === 'el' ? 'Διαγνώστηκε από Oli · AI Γεωπόνος' : 'Diagnosed by Oli · AI Agronomist'}
          </p>
        </div>

      </main>
    </div>
  );
}
