import { useQuery } from '@tanstack/react-query';
import { ClipboardList, ChevronDown, ChevronUp, CheckCircle2, Clock, AlertTriangle, Leaf, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../lib/LanguageContext';
import type { T } from '../lib/i18n';
import clsx from 'clsx';

interface Intervention {
  id: string;
  crop_type: string | null;
  problem: string | null;
  product_applied: string | null;
  dosage: string | null;
  application_method: string | null;
  notes: string | null;
  date: string | null;
  applied_at: string | null;
  outcome: string | null;
  vio_step: number | null;
  applied_confirmed: boolean | null;
  improvement_note: string | null;
  follow_up_at: string | null;
  field_id: string | null;
  grower_id: string | null;
}

interface FieldLookup {
  id: string;
  name: string;
}

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function VioStepBadge({ step, outcome, t }: { step: number | null; outcome: string | null; t: T }) {
  if (outcome) {
    const cfg: Record<string, { color: string; label: string }> = {
      better:  { color: 'text-green-400 bg-green-500/10 border-green-500/30', label: t.outcomeBetter },
      same:    { color: 'text-amber-400 bg-amber-500/10 border-amber-500/30', label: t.outcomeSame },
      worse:   { color: 'text-red-400 bg-red-500/10 border-red-500/30', label: t.outcomeWorse },
    };
    const c = cfg[outcome] ?? cfg.same;
    return <span className={clsx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', c.color)}>{c.label}</span>;
  }

  const s = step ?? 0;
  if (s === 0) return <span className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-surface px-2 py-0.5 text-[11px] font-medium text-muted"><Clock className="h-3 w-3" />{t.followUpPending}</span>;
  if (s === 1) return <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-400"><Clock className="h-3 w-3" />{t.stepApplyCheck}</span>;
  if (s === 2) return <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[11px] font-medium text-purple-400"><Clock className="h-3 w-3" />{t.stepOutcomeCheck}</span>;
  return <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"><CheckCircle2 className="h-3 w-3" />{t.stepComplete}</span>;
}

export default function History() {
  const { appUserId, profile } = useAuth();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const tier = profile?.tier as string | undefined;
  const isAdvisor = tier === 'agronomist' || tier === 'expert' || tier === 'enterprise';

  // Advisors see their own interventions PLUS any interventions belonging to
  // growers they own. Farmers just see their own.
  const { data: interventions = [], isLoading } = useQuery({
    queryKey: ['interventions', appUserId, isAdvisor],
    queryFn: async () => {
      let growerIds: string[] = [];
      if (isAdvisor && appUserId) {
        const { data: gs } = await supabase
          .from('growers').select('id').eq('advisor_id', appUserId);
        growerIds = (gs ?? []).map((g: { id: string }) => g.id);
      }

      const orClauses: string[] = [`user_id.eq.${appUserId}`];
      if (growerIds.length > 0) {
        orClauses.push(`grower_id.in.(${growerIds.join(',')})`);
      }

      const { data, error } = await supabase
        .from('interventions')
        .select('*')
        .or(orClauses.join(','))
        .order('applied_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Intervention[];
    },
    enabled: !!appUserId,
  });

  const { data: growerMap = {} } = useQuery({
    queryKey: ['growers-lookup', appUserId],
    queryFn: async () => {
      if (!isAdvisor) return {};
      const { data } = await supabase
        .from('growers').select('id, name').eq('advisor_id', appUserId!);
      const map: Record<string, string> = {};
      (data ?? []).forEach((g: { id: string; name: string }) => { map[g.id] = g.name; });
      return map;
    },
    enabled: !!appUserId && isAdvisor,
  });

  const { data: fieldMap = {} } = useQuery({
    queryKey: ['fields-lookup', appUserId],
    queryFn: async () => {
      const { data } = await supabase
        .from('fields')
        .select('id, name')
        .eq('user_id', appUserId!);
      const map: Record<string, string> = {};
      (data ?? []).forEach((f: FieldLookup) => { map[f.id] = f.name; });
      return map;
    },
    enabled: !!appUserId,
  });

  const toggle = (id: string) => setExpandedId(prev => prev === id ? null : id);

  return (
    <div className="flex h-[calc(100dvh-104px)] md:h-[calc(100dvh-48px)] flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border/50 px-4 py-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">{t.interventionHistory}</h1>
        </div>
        <p className="mt-0.5 text-xs text-muted">{t.historySubtitle}</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface" />)}
          </div>
        ) : interventions.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <ClipboardList className="h-16 w-16 text-primary/20" />
            <div>
              <h3 className="font-semibold text-foreground">{t.noHistoryTitle}</h3>
              <p className="mt-1 text-sm text-muted">{t.noHistoryBody}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 pb-8">
            {interventions.map((item) => {
              const expanded = expandedId === item.id;
              const dateStr = item.applied_at || item.date;
              const days = dateStr ? daysAgo(dateStr) : null;
              const fieldName = item.field_id ? fieldMap[item.field_id] : null;
              const growerName = item.grower_id ? growerMap[item.grower_id] : null;

              return (
                <div key={item.id} className="rounded-2xl border border-border/50 bg-surface overflow-hidden">
                  {/* Summary row */}
                  <button
                    onClick={() => toggle(item.id)}
                    className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-background/40"
                  >
                    {/* Timeline dot */}
                    <div className="mt-1 flex flex-col items-center">
                      <div className={clsx(
                        'h-3 w-3 rounded-full border-2',
                        item.outcome ? 'border-primary bg-primary' : 'border-muted bg-surface'
                      )} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground text-sm truncate">
                          {item.problem || item.crop_type || 'Intervention'}
                        </span>
                        <VioStepBadge step={item.vio_step} outcome={item.outcome} t={t} />
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                        {dateStr && (
                          <span>
                            {days === 0 ? t.today : days === 1 ? t.yesterday : `${days} ${t.daysAgo}`}
                          </span>
                        )}
                        {growerName && (
                          <>
                            <span className="text-border">·</span>
                            <span className="font-medium text-foreground/80">{growerName}</span>
                          </>
                        )}
                        {fieldName && (
                          <>
                            <span className="text-border">·</span>
                            <span className="flex items-center gap-1"><Leaf className="h-3 w-3" />{fieldName}</span>
                          </>
                        )}
                        {item.crop_type && item.problem && (
                          <>
                            <span className="text-border">·</span>
                            <span>{item.crop_type}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {expanded
                      ? <ChevronUp className="h-4 w-4 text-muted flex-shrink-0 mt-1" />
                      : <ChevronDown className="h-4 w-4 text-muted flex-shrink-0 mt-1" />
                    }
                  </button>

                  {/* Expanded details */}
                  {expanded && (
                    <div className="border-t border-border/30 px-4 py-3 space-y-2 text-sm">
                      {item.product_applied && (
                        <div className="flex gap-2">
                          <span className="text-muted w-16 flex-shrink-0">{t.productLabel}</span>
                          <span className="text-foreground">{item.product_applied}</span>
                        </div>
                      )}
                      {item.dosage && (
                        <div className="flex gap-2">
                          <span className="text-muted w-16 flex-shrink-0">{t.dosageLabel}</span>
                          <span className="text-foreground">{item.dosage}</span>
                        </div>
                      )}
                      {item.application_method && (
                        <div className="flex gap-2">
                          <span className="text-muted w-16 flex-shrink-0">{t.methodLabel}</span>
                          <span className="text-foreground">{item.application_method}</span>
                        </div>
                      )}
                      {item.notes && (
                        <div className="flex gap-2">
                          <span className="text-muted w-16 flex-shrink-0">{t.notes}</span>
                          <span className="text-foreground">{item.notes}</span>
                        </div>
                      )}
                      {item.improvement_note && (
                        <div className="flex gap-2">
                          <span className="text-muted w-16 flex-shrink-0">{t.outcomeLabel}</span>
                          <span className="text-foreground">{item.improvement_note}</span>
                        </div>
                      )}
                      {item.follow_up_at && !item.outcome && (
                        <div className="mt-2 flex items-center gap-2 rounded-xl bg-amber-500/5 border border-amber-500/20 px-3 py-2 text-xs text-amber-400">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {t.followUpPending}: {new Date(item.follow_up_at).toLocaleDateString()}
                        </div>
                      )}
                      <button
                        onClick={() => navigate('/chat')}
                        className="mt-3 flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        {lang === 'el' ? 'Ρώτα τον Oli' : 'Ask Oli about this'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
