import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Leaf, ArrowLeft } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

export default function SharedDiagnosis() {
  const { shareId } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSharedData() {
      if (!shareId) return;
      
      const { data: intervention, error } = await supabase
        .from('safe_shared_diagnoses')
        .select('*')
        .eq('share_id', shareId)
        .maybeSingle();

      if (!error && intervention) {
        setData(intervention);
        setLoading(false);
        return;
      }

      const { data: legacyIntervention, error: legacyError } = await supabase
        .from('safe_shared_diagnoses')
        .select('*')
        .eq('legacy_intervention_id', shareId)
        .maybeSingle();

      if (!legacyError && legacyIntervention) {
        setData(legacyIntervention);
      }

      setLoading(false);
    }

    fetchSharedData();
  }, [shareId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
        <Leaf className="mb-4 h-12 w-12 text-muted" />
        <h1 className="mb-2 text-xl font-semibold text-foreground">Diagnosis Not Found</h1>
        <p className="mb-6 text-muted">This shared link is invalid or has expired.</p>
        <Link to="/" className="rounded-xl bg-primary px-6 py-3 font-medium text-white transition-colors hover:bg-primary/90">
          Go to Oli
        </Link>
      </div>
    );
  }

  const problem = data.problem || data.diagnosis || 'Unknown Issue';
  const product = data.product_applied || data.product || '';

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-primary hover:opacity-80">
            <Leaf className="h-6 w-6" />
            <span className="text-lg font-semibold">Oli</span>
          </Link>
          <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            Shared Diagnosis
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl p-4 pt-8">
        <div className="overflow-hidden rounded-3xl border border-border/50 bg-surface shadow-sm">
          <div className="border-b border-border/50 bg-muted/5 p-6">
            <div className="mb-2 text-sm font-medium uppercase tracking-wider text-muted">
              {data.crop_type || 'Crop'}
            </div>
            <h1 className="text-2xl font-semibold text-foreground">{problem}</h1>
            {data.share_summary && (
              <p className="mt-2 text-[15px] text-muted">{data.share_summary}</p>
            )}
          </div>
          
          <div className="p-6">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted">Recommended Action</h2>
            
            <div className="space-y-4">
              {product && product !== 'Diagnosis' && (
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Leaf className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground">Product</div>
                    <div className="text-[15px] text-muted">{product}</div>
                  </div>
                </div>
              )}
              
              {data.dosage && (
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <div className="text-lg font-semibold text-primary">⚖️</div>
                  </div>
                  <div>
                    <div className="font-medium text-foreground">Dosage</div>
                    <div className="text-[15px] text-muted">{data.dosage}</div>
                  </div>
                </div>
              )}
              
              {data.application_method && (
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <div className="text-lg font-semibold text-primary">💧</div>
                  </div>
                  <div>
                    <div className="font-medium text-foreground">Application Method</div>
                    <div className="text-[15px] text-muted">{data.application_method}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="mt-8 text-center">
          <p className="mb-4 text-sm text-muted">Want your own AI agronomist?</p>
          <Link to="/" className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 font-medium text-white transition-colors hover:bg-primary/90">
            Try Oli for Free
          </Link>
        </div>
      </main>
    </div>
  );
}
