import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Leaf, AlertTriangle, ChevronRight } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

const SEVERITY_BADGE: Record<string, { label: string; cls: string }> = {
  low:    { label: 'Χαμηλή σοβαρότητα',  cls: 'bg-green-500/10 text-green-400 border-green-500/20' },
  medium: { label: 'Μέτρια σοβαρότητα',  cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  high:   { label: 'Υψηλή σοβαρότητα',   cls: 'bg-red-500/10   text-red-400   border-red-500/20'   },
};

export default function SharedDiagnosis() {
  const { shareId } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shareId) { setLoading(false); return; }
    (async () => {
      const { data: d1 } = await supabase
        .from('safe_shared_diagnoses').select('*').eq('share_id', shareId).maybeSingle();
      if (d1) { setData(d1); setLoading(false); return; }
      const { data: d2 } = await supabase
        .from('safe_shared_diagnoses').select('*').eq('legacy_intervention_id', shareId).maybeSingle();
      setData(d2 ?? null);
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
      : 'Διαγνώστηκε με Oli — AI γεωπόνος για Μεσογειακούς αγρότες.';

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
  }, [data, shareId]);

  if (loading) return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#0D1117]">
      <LoadingSpinner />
    </div>
  );

  /* ── Not found ── */
  if (!data) return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#0D1117] p-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#2EA043]/10">
        <Leaf className="h-7 w-7 text-[#2EA043]" />
      </div>
      <h1 className="mb-2 text-lg font-semibold text-white">Δεν βρέθηκε διάγνωση</h1>
      <p className="mb-6 text-sm text-[#8B949E]">Ο σύνδεσμος δεν είναι έγκυρος ή έχει λήξει.</p>
      <Link to="/" className="rounded-full bg-[#2EA043] px-6 py-2.5 text-sm font-medium text-white">
        Δοκίμασε το Oli
      </Link>
    </div>
  );

  const problem = data.problem || data.diagnosis || 'Άγνωστο πρόβλημα';
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
          AI Διάγνωση
        </span>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-6 space-y-4">

        {/* Hero card — the diagnosis */}
        <div className="rounded-2xl border border-white/8 bg-[#161C23] p-5">
          <p className="mb-1 text-xs font-medium uppercase tracking-widest text-[#2EA043]">
            {data.crop_type || 'Καλλιέργεια'}
          </p>
          <h1 className="text-xl font-semibold leading-snug">{problem}</h1>
          {data.cause && (
            <p className="mt-2 text-sm text-[#8B949E]">Αιτία: {data.cause}</p>
          )}
          {sev && (
            <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${sev.cls}`}>
              <AlertTriangle className="h-3 w-3" />{sev.label}
            </span>
          )}
        </div>

        {/* Treatment */}
        {(product || data.dosage || data.application_method) && (
          <div className="rounded-2xl border border-white/8 bg-[#161C23] p-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-[#8B949E]">Αντιμετώπιση</p>
            <div className="space-y-3 text-sm">
              {product && (
                <div className="flex justify-between">
                  <span className="text-[#8B949E]">Προϊόν</span>
                  <span className="font-medium text-right max-w-[60%]">{product}</span>
                </div>
              )}
              {data.dosage && (
                <div className="flex justify-between">
                  <span className="text-[#8B949E]">Δοσολογία</span>
                  <span className="font-medium text-right max-w-[60%]">{data.dosage}</span>
                </div>
              )}
              {data.application_method && (
                <div className="flex justify-between">
                  <span className="text-[#8B949E]">Εφαρμογή</span>
                  <span className="font-medium text-right max-w-[60%]">{data.application_method}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Organic options */}
        {organic.length > 0 && (
          <div className="rounded-2xl border border-[#2EA043]/20 bg-[#2EA043]/5 p-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-[#2EA043]">Βιολογικές επιλογές</p>
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
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-blue-400">Χημικές επιλογές</p>
            <ul className="space-y-2">
              {chemical.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                  <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-400" />{t}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Acquisition CTA — the whole point of this page */}
        <div className="rounded-2xl border border-[#2EA043]/30 bg-[#2EA043]/8 p-5">
          <p className="mb-1 text-base font-semibold">Έχεις το ίδιο πρόβλημα;</p>
          <p className="mb-4 text-sm text-[#8B949E]">
            Ο Oli διαγνώσκει προβλήματα καλλιεργειών από φωτογραφία σε δευτερόλεπτα.
            Δωρεάν για τους πρώτους 20 ερωτήσεις.
          </p>
          <Link
            to="/"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#2EA043] py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Δοκίμασε το Oli δωρεάν
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Footer trust signal */}
        <p className="text-center text-xs text-[#8B949E] pb-4">
          Διαγνώστηκε από Oli · AI Γεωπόνος για Μεσογειακούς αγρότες
        </p>

      </main>
    </div>
  );
}
