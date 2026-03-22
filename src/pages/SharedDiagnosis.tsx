import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Leaf, AlertTriangle, Droplets, FlaskConical, Sprout } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-green-500/10 text-green-400 border-green-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  high: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const SEVERITY_LABELS: Record<string, string> = {
  low: 'Low severity',
  medium: 'Medium severity',
  high: 'High severity',
};

export default function SharedDiagnosis() {
  const { shareId } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSharedData() {
      if (!shareId) { setLoading(false); return; }

      const { data: byShareId } = await supabase
        .from('safe_shared_diagnoses')
        .select('*')
        .eq('share_id', shareId)
        .maybeSingle();

      if (byShareId) { setData(byShareId); setLoading(false); return; }

      // Legacy fallback — old links used the intervention UUID directly
      const { data: byLegacy } = await supabase
        .from('safe_shared_diagnoses')
        .select('*')
        .eq('legacy_intervention_id', shareId)
        .maybeSingle();

      setData(byLegacy ?? null);
      setLoading(false);
    }
    fetchSharedData();
  }, [shareId]);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background p-6 text-center">
        <Leaf className="mb-4 h-12 w-12 text-muted" />
        <h1 className="mb-2 text-xl font-semibold text-foreground">Diagnosis Not Found</h1>
        <p className="mb-6 text-sm text-muted">This link is invalid or has expired.</p>
        <Link to="/" className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90">
          Try Oli
        </Link>
      </div>
    );
  }

  const problem = data.problem || data.diagnosis || 'Unknown Issue';
  const product = data.product_applied || data.product || '';
  const organic: string[] = Array.isArray(data.organic_treatments) ? data.organic_treatments : [];
  const chemical: string[] = Array.isArray(data.chemical_treatments) ? data.chemical_treatments : [];
  const severity = data.severity as string | null;

  return (
    <div className="min-h-[100dvh] bg-background pb-16">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/90 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-foreground hover:opacity-80">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
              <Leaf className="h-4 w-4 text-primary" />
            </div>
            <span className="text-base font-semibold">Oli</span>
          </Link>
          <span className="rounded-full border border-border/50 bg-surface px-3 py-1 text-xs text-muted">
            Shared diagnosis
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-4 p-4 pt-6">

        {/* Problem card */}
        <div className="rounded-2xl border border-border/50 bg-surface p-5">
          <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted">
            {data.crop_type || 'Crop'}
          </div>
          <h1 className="text-xl font-semibold text-foreground">{problem}</h1>
          {data.cause && (
            <p className="mt-2 text-sm text-muted">Cause: {data.cause}</p>
          )}
          {data.share_summary && !data.cause && (
            <p className="mt-2 text-sm text-muted">{data.share_summary}</p>
          )}
          {severity && SEVERITY_COLORS[severity] && (
            <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${SEVERITY_COLORS[severity]}`}>
              <AlertTriangle className="h-3 w-3" />
              {SEVERITY_LABELS[severity]}
            </span>
          )}
        </div>

        {/* Product / application */}
        {(product || data.dosage || data.application_method) && (
          <div className="rounded-2xl border border-border/50 bg-surface p-5">
            <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted">Treatment</h2>
            <div className="space-y-3">
              {product && (
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <FlaskConical className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="text-xs text-muted">Product</div>
                    <div className="text-sm font-medium text-foreground">{product}</div>
                  </div>
                </div>
              )}
              {data.dosage && (
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Droplets className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="text-xs text-muted">Dosage</div>
                    <div className="text-sm font-medium text-foreground">{data.dosage}</div>
                  </div>
                </div>
              )}
              {data.application_method && (
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Sprout className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="text-xs text-muted">Application method</div>
                    <div className="text-sm font-medium text-foreground">{data.application_method}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Organic treatments */}
        {organic.length > 0 && (
          <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-5">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-green-400">Organic options</h2>
            <ul className="space-y-2">
              {organic.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-400" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Chemical treatments */}
        {chemical.length > 0 && (
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-blue-400">Chemical options</h2>
            <ul className="space-y-2">
              {chemical.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-400" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA */}
        <div className="pt-4 text-center">
          <p className="mb-4 text-sm text-muted">Get AI agronomic advice for your own crops</p>
          <Link to="/" className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90">
            <Leaf className="h-4 w-4" />
            Try Oli free
          </Link>
        </div>

      </main>
    </div>
  );
}
