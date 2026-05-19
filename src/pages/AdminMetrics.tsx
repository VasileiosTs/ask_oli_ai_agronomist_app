import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, TrendingUp, Activity, BarChart3, Target, Zap,
  ArrowUp, ArrowDown, Minus, RefreshCw, Loader2, ShieldAlert,
  ArrowLeft, Calendar, Gift, Trash2, Plus, Download, Eye, EyeOff
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../lib/LanguageContext';
import clsx from 'clsx';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KpiSnapshot {
  snapshot_date: string;
  total_users: number;
  new_users_today: number;
  new_users_week: number;
  new_users_month: number;
  dau: number;
  wau: number;
  mau: number;
  activation_rate_24h: number;
  onboarding_completion_rate: number;
  avg_messages_per_active_user: number;
  total_messages_today: number;
  total_photos_today: number;
  total_conversations: number;
  avg_conversations_per_user: number;
  vio_logged_count: number;
  vio_completed_count: number;
  vio_completion_rate: number;
  retention_d1: number;
  retention_d7: number;
  retention_d30: number;
  paying_users: number;   // tier_source = 'stripe' only
  trial_users: number;    // tier_source = 'trial'
  promo_users: number;    // tier_source = 'promo'
  free_users: number;     // tier null or 'free'
  mrr_cents: number;
  churned_users_30d: number;
  users_with_photos: number;
  users_with_fields: number;
  users_with_interventions: number;
  positive_feedback_count: number;
  negative_feedback_count: number;
}

interface PromoCode {
  code: string;
  grants_tier: string;
  duration_days: number;
  max_redemptions: number | null;
  redemptions_count: number;
  expires_at: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

interface PromoRedemption {
  id: string;
  code: string;
  granted_tier: string;
  granted_until: string;
  redeemed_at: string;
  user_id: string;
}

interface TierBreakdown {
  free: number;
  trial: number;
  pro_monthly: number;
  pro_yearly: number;
  master_monthly: number;
  master_yearly: number;
  enterprise: number;
  promo: number;
  manual: number;
  total: number;
  mrr_cents: number; // calculated from actual billing periods
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function TrendBadge({ current, previous }: { current: number; previous: number }) {
  if (!previous) return <span className="text-xs text-muted">—</span>;
  const pct = ((current - previous) / previous) * 100;
  const isUp = pct > 0;
  const isFlat = Math.abs(pct) < 0.5;
  return (
    <span className={clsx('inline-flex items-center gap-0.5 text-xs font-medium', {
      'text-green-400': isUp && !isFlat,
      'text-red-400': !isUp && !isFlat,
      'text-muted': isFlat,
    })}>
      {isFlat ? <Minus className="h-3 w-3" /> : isUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, subtitle, trend, accent }: {
  icon: typeof Users;
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: { current: number; previous: number };
  accent?: boolean;
}) {
  return (
    <div className={clsx(
      'rounded-2xl p-4 border',
      accent
        ? 'bg-primary/10 border-primary/30'
        : 'bg-surface border-border/30'
    )}>
      <div className="flex items-center gap-2 mb-2">
        <div className={clsx('flex h-7 w-7 items-center justify-center rounded-lg', accent ? 'bg-primary/20' : 'bg-background')}>
          <Icon className={clsx('h-3.5 w-3.5', accent ? 'text-primary' : 'text-muted')} />
        </div>
        <span className="text-[11px] text-muted font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-foreground">{value}</span>
        {trend && <TrendBadge current={trend.current} previous={trend.previous} />}
      </div>
      {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: typeof Users; title: string }) {
  return (
    <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" /> {title}
    </h2>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminMetrics() {
  const { user } = useAuth();
  const { lang } = useLanguage();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [snapshots, setSnapshots] = useState<KpiSnapshot[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [recentRedemptions, setRecentRedemptions] = useState<PromoRedemption[]>([]);
  const [liveActiveUsers, setLiveActiveUsers] = useState<number | null>(null);
  const [tierBreakdown, setTierBreakdown] = useState<TierBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Promo creation form
  const [promoForm, setPromoForm] = useState({
    code: '', tier: 'pro', days: 90, maxRedemptions: 500, expiresMonths: 6, notes: '', open: false
  });
  const [promoSaving, setPromoSaving] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  // Bulk generation form
  const [bulkForm, setBulkForm] = useState({ prefix: 'O', count: 50, tier: 'pro', days: 90, open: false });
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkResult, setBulkResult] = useState<string[]>([]);

  // Active tab
  const [tab, setTab] = useState<'metrics' | 'promo'>('metrics');

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadSnapshots = useCallback(async () => {
    const { data } = await supabase
      .from('kpi_snapshots')
      .select('*')
      .order('snapshot_date', { ascending: false })
      .limit(90);
    if (data) setSnapshots(data as KpiSnapshot[]);
  }, []);

  const loadPromoCodes = useCallback(async () => {
    const { data } = await supabase
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setPromoCodes(data as PromoCode[]);
  }, []);

  const loadRecentRedemptions = useCallback(async () => {
    const { data } = await supabase
      .from('promo_redemptions')
      .select('id, code, granted_tier, granted_until, redeemed_at, user_id')
      .order('redeemed_at', { ascending: false })
      .limit(50);
    if (data) setRecentRedemptions(data as PromoRedemption[]);
  }, []);

  const loadLiveActiveUsers = useCallback(async () => {
    // "Active now" = sent a message in the last 15 minutes
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('chat_messages')
      .select('user_id', { count: 'exact', head: true })
      .eq('role', 'user')
      .gte('created_at', cutoff);
    setLiveActiveUsers(count ?? 0);
  }, []);

  const loadTierBreakdown = useCallback(async () => {
    const { data } = await supabase
      .from('users')
      .select('tier, tier_source, billing_period');
    if (!data) return;

    const bd: TierBreakdown = {
      free: 0, trial: 0,
      pro_monthly: 0, pro_yearly: 0,
      master_monthly: 0, master_yearly: 0,
      enterprise: 0, promo: 0, manual: 0,
      total: data.length, mrr_cents: 0,
    };

    for (const u of data) {
      const tier    = u.tier as string | null;
      const src     = u.tier_source as string | null;
      const period  = u.billing_period as string | null;
      const yearly  = period === 'yearly';

      if (!tier || tier === 'free') { bd.free++;    continue; }
      if (src === 'trial')          { bd.trial++;   continue; }
      if (src === 'promo')          { bd.promo++;   continue; }
      if (src === 'manual')         { bd.manual++;  continue; }

      if (src === 'stripe') {
        if (tier === 'pro') {
          if (yearly) { bd.pro_yearly++;    bd.mrr_cents += 408; } // €49/yr ÷ 12
          else        { bd.pro_monthly++;   bd.mrr_cents += 499; } // €4.99/mo
        } else if (tier === 'master') {
          if (yearly) { bd.master_yearly++; bd.mrr_cents += 4083; } // €490/yr ÷ 12
          else        { bd.master_monthly++;bd.mrr_cents += 4900; } // €49/mo
        } else {
          bd.enterprise++; // custom pricing — not counted in MRR
        }
        continue;
      }
      bd.free++; // fallback
    }
    setTierBreakdown(bd);
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([
      loadSnapshots(),
      loadPromoCodes(),
      loadRecentRedemptions(),
      loadLiveActiveUsers(),
      loadTierBreakdown(),
    ]);
  }, [loadSnapshots, loadPromoCodes, loadRecentRedemptions, loadLiveActiveUsers, loadTierBreakdown]);

  useEffect(() => {
    if (!user) { setIsAdmin(false); setLoading(false); return; }
    Promise.resolve(supabase.from('admin_users').select('id').eq('auth_id', user.id).maybeSingle())
      .then(({ data }) => {
        setIsAdmin(!!data);
        if (data) loadAll().finally(() => setLoading(false));
        else setLoading(false);
      })
      .catch(() => { setIsAdmin(false); setLoading(false); });
  }, [user, loadAll]);

  // Refresh live counter every 60s while on metrics tab
  useEffect(() => {
    if (!isAdmin) return;
    const id = setInterval(loadLiveActiveUsers, 60_000);
    return () => clearInterval(id);
  }, [isAdmin, loadLiveActiveUsers]);

  const triggerSnapshot = async () => {
    setRefreshing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kpi-snapshot`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ date: new Date().toISOString().split('T')[0] }),
        }
      );
      if (res.ok) await loadSnapshots();
    } catch (e) { console.error('Snapshot trigger failed:', e); }
    setRefreshing(false);
  };

  // ── Promo actions ─────────────────────────────────────────────────────────

  const createPromoCode = async () => {
    setPromoSaving(true);
    setPromoError(null);
    const code = promoForm.code.trim().toUpperCase();
    if (code.length < 3) { setPromoError('Code must be at least 3 characters'); setPromoSaving(false); return; }
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + promoForm.expiresMonths);
    const { error } = await supabase.from('promo_codes').insert({
      code,
      grants_tier: promoForm.tier,
      duration_days: promoForm.days,
      max_redemptions: promoForm.maxRedemptions,
      expires_at: expiresAt.toISOString(),
      notes: promoForm.notes || null,
    });
    if (error) { setPromoError(error.message); } else {
      setPromoForm(f => ({ ...f, code: '', notes: '', open: false }));
      await loadPromoCodes();
    }
    setPromoSaving(false);
  };

  const togglePromoActive = async (code: string, current: boolean) => {
    await supabase.from('promo_codes').update({ is_active: !current }).eq('code', code);
    await loadPromoCodes();
  };

  const generateBulk = async () => {
    setBulkGenerating(true);
    setBulkResult([]);
    const { data, error } = await supabase.rpc('generate_promo_batch', {
      p_prefix: bulkForm.prefix.toUpperCase().trim() || 'O',
      p_count: bulkForm.count,
      p_tier: bulkForm.tier,
      p_duration_days: bulkForm.days,
      p_expires_at: null,
      p_notes: `Bulk ${bulkForm.count}x ${bulkForm.tier} ${bulkForm.days}d`,
    });
    if (!error && Array.isArray(data)) setBulkResult(data as string[]);
    await loadPromoCodes();
    setBulkGenerating(false);
  };

  const downloadBulkCodes = () => {
    const text = bulkResult.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `oli-promo-codes-${Date.now()}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Guard states ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-6 text-center">
        <ShieldAlert className="h-12 w-12 text-red-400 mb-4" />
        <h1 className="text-xl font-semibold text-foreground mb-2">
          {lang === 'el' ? 'Δεν έχεις πρόσβαση.' : 'Access denied.'}
        </h1>
        <p className="text-sm text-muted mb-6">
          {lang === 'el' ? 'Αυτή η σελίδα είναι μόνο για admins.' : 'This page is admin-only.'}
        </p>
        <Link to="/" className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-white">
          {lang === 'el' ? 'Αρχική' : 'Home'}
        </Link>
      </div>
    );
  }

  const today = snapshots[0];
  const yesterday = snapshots[1];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-[100dvh] bg-background pb-16">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-xl border-b border-border/30 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/profile" className="p-1">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </Link>
            <div>
              <h1 className="text-base font-bold text-foreground">Admin</h1>
              {liveActiveUsers !== null && (
                <p className="text-[11px] text-primary font-medium">
                  {liveActiveUsers} active now
                </p>
              )}
            </div>
          </div>
          <button
            onClick={triggerSnapshot}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            <RefreshCw className={clsx('h-3 w-3', refreshing && 'animate-spin')} />
            {refreshing ? 'Generating...' : 'Snapshot'}
          </button>
        </div>

        {/* Tab bar */}
        <div className="max-w-4xl mx-auto flex gap-1 mt-2">
          {(['metrics', 'promo'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                tab === t ? 'bg-primary text-white' : 'text-muted hover:text-foreground'
              )}
            >
              {t === 'metrics' ? 'KPIs' : 'Promo Codes'}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-5 space-y-6">

        {/* ═══ TAB: METRICS ═══════════════════════════════════════════════ */}
        {tab === 'metrics' && (
          <>
            {!today ? (
              <div className="text-center py-12 text-muted text-sm">
                No data yet. Click "Snapshot" to generate the first snapshot.
              </div>
            ) : (
              <>
                {/* Date */}
                <div className="flex items-center gap-2 text-xs text-muted">
                  <Calendar className="h-3.5 w-3.5" />
                  {today.snapshot_date}
                </div>

                {/* Live strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-2xl bg-primary/5 border border-primary/20">
                  <div>
                    <p className="text-[11px] text-muted uppercase tracking-wide mb-1">Active Now</p>
                    <p className="text-2xl font-bold text-primary">{liveActiveUsers ?? '—'}</p>
                    <p className="text-[10px] text-muted">last 15 min</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted uppercase tracking-wide mb-1">Msgs Today</p>
                    <p className="text-2xl font-bold text-foreground">{today.total_messages_today}</p>
                    <p className="text-[10px] text-muted">+ {today.total_photos_today} photos</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted uppercase tracking-wide mb-1">New This Week</p>
                    <p className="text-2xl font-bold text-foreground">{today.new_users_week}</p>
                    <p className="text-[10px] text-muted">last 7 days</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted uppercase tracking-wide mb-1">New This Month</p>
                    <p className="text-2xl font-bold text-foreground">{today.new_users_month}</p>
                    <p className="text-[10px] text-muted">last 30 days</p>
                  </div>
                </div>

                {/* Users */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard icon={Users} label="Total Users" value={today.total_users}
                    trend={yesterday ? { current: today.total_users, previous: yesterday.total_users } : undefined} />
                  <MetricCard icon={Activity} label="DAU" value={today.dau} accent
                    trend={yesterday ? { current: today.dau, previous: yesterday.dau } : undefined} />
                  <MetricCard icon={Activity} label="WAU" value={today.wau}
                    trend={yesterday ? { current: today.wau, previous: yesterday.wau } : undefined} />
                  <MetricCard icon={Activity} label="MAU" value={today.mau}
                    trend={yesterday ? { current: today.mau, previous: yesterday.mau } : undefined} />
                </div>

                {/* Growth */}
                <div>
                  <SectionTitle icon={TrendingUp} title="Growth" />
                  <div className="grid grid-cols-3 gap-3">
                    <MetricCard icon={Users} label="New Today" value={today.new_users_today} />
                    <MetricCard icon={Users} label="New This Week" value={today.new_users_week} />
                    <MetricCard icon={Users} label="New This Month" value={today.new_users_month} />
                  </div>
                </div>

                {/* Activation */}
                <div>
                  <SectionTitle icon={Zap} title="Activation & Engagement" />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <MetricCard icon={Zap} label="Activation 24h" value={`${today.activation_rate_24h}%`} />
                    <MetricCard icon={Zap} label="Onboarding" value={`${today.onboarding_completion_rate}%`} />
                    <MetricCard icon={BarChart3} label="Msg/User/Day" value={today.avg_messages_per_active_user} />
                    <MetricCard icon={BarChart3} label="Total Convos" value={today.total_conversations} />
                  </div>
                </div>

                {/* Retention */}
                <div>
                  <SectionTitle icon={Target} title="Retention" />
                  <div className="grid grid-cols-3 gap-3">
                    <MetricCard icon={Target} label="D1" value={`${today.retention_d1}%`} subtitle="Day 1 return"
                      trend={yesterday ? { current: today.retention_d1, previous: yesterday.retention_d1 } : undefined} />
                    <MetricCard icon={Target} label="D7" value={`${today.retention_d7}%`} subtitle="Day 7 return"
                      trend={yesterday ? { current: today.retention_d7, previous: yesterday.retention_d7 } : undefined} />
                    <MetricCard icon={Target} label="D30" value={`${today.retention_d30}%`} subtitle="Day 30 return"
                      trend={yesterday ? { current: today.retention_d30, previous: yesterday.retention_d30 } : undefined} />
                  </div>
                </div>

                {/* VIO */}
                <div>
                  <SectionTitle icon={BarChart3} title="VIO Funnel" />
                  <div className="grid grid-cols-3 gap-3">
                    <MetricCard icon={BarChart3} label="Interventions Logged" value={today.vio_logged_count} />
                    <MetricCard icon={BarChart3} label="Outcomes Recorded" value={today.vio_completed_count} />
                    <MetricCard icon={BarChart3} label="Completion Rate" value={`${today.vio_completion_rate}%`} accent />
                  </div>
                </div>

                {/* Feature Adoption */}
                <div>
                  <SectionTitle icon={Zap} title="Feature Adoption" />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <MetricCard icon={Zap} label="Used Photos" value={today.users_with_photos}
                      subtitle={`${today.total_users ? ((today.users_with_photos / today.total_users) * 100).toFixed(0) : 0}% of users`} />
                    <MetricCard icon={Zap} label="Have Fields" value={today.users_with_fields} />
                    <MetricCard icon={Zap} label="Interventions" value={today.users_with_interventions} />
                    <MetricCard icon={Zap} label="Feedback +/-"
                      value={`${today.positive_feedback_count}/${today.negative_feedback_count}`} />
                  </div>
                </div>

                {/* Revenue & Tier Breakdown */}
                <div>
                  <SectionTitle icon={TrendingUp} title="Revenue" />
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <MetricCard icon={Users} label="Paying (Stripe)" value={today.paying_users ?? 0} accent />
                    <MetricCard icon={TrendingUp} label="MRR" value={`€${((today.mrr_cents ?? 0) / 100).toFixed(2)}`} accent />
                    <MetricCard icon={Activity} label="Churned 30d" value={today.churned_users_30d} />
                  </div>

                  {/* Subscription breakdown — monthly vs yearly split */}
                  <div className="rounded-xl border border-border/30 overflow-hidden">
                    <div className="px-4 py-2.5 bg-surface/60 border-b border-border/30 flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">Subscription breakdown</span>
                      <div className="flex items-center gap-3">
                        {tierBreakdown && (
                          <span className="text-[10px] text-primary font-semibold">
                            MRR €{(tierBreakdown.mrr_cents / 100).toFixed(2)}
                          </span>
                        )}
                        <button
                          onClick={loadTierBreakdown}
                          className="text-[10px] text-muted hover:text-foreground flex items-center gap-1"
                        >
                          <RefreshCw className="h-2.5 w-2.5" /> refresh
                        </button>
                      </div>
                    </div>
                    {tierBreakdown ? (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border/20 text-muted">
                            <th className="px-4 py-2 text-left font-medium">Segment</th>
                            <th className="px-4 py-2 text-right font-medium">Users</th>
                            <th className="px-4 py-2 text-right font-medium">% total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { label: 'Free',               value: tierBreakdown.free,           color: 'text-muted',        group: false },
                            { label: 'Trial — Pro (30d)',   value: tierBreakdown.trial,          color: 'text-amber-400',    group: false },
                            { label: 'Pro — Monthly',       value: tierBreakdown.pro_monthly,    color: 'text-emerald-400',  group: true  },
                            { label: 'Pro — Yearly',        value: tierBreakdown.pro_yearly,     color: 'text-emerald-500',  group: true  },
                            { label: 'Master — Monthly',    value: tierBreakdown.master_monthly, color: 'text-emerald-400',  group: true  },
                            { label: 'Master — Yearly',     value: tierBreakdown.master_yearly,  color: 'text-emerald-500',  group: true  },
                            { label: 'Enterprise',          value: tierBreakdown.enterprise,     color: 'text-emerald-400',  group: true  },
                            { label: 'Promo code',          value: tierBreakdown.promo,          color: 'text-blue-400',     group: false },
                            { label: 'Manual',              value: tierBreakdown.manual,         color: 'text-muted',        group: false },
                          ].map(({ label, value, color, group }) => value > 0 && (
                            <tr key={label} className="border-b border-border/20 last:border-0">
                              <td className={`px-4 py-2 ${group ? 'pl-6' : ''} text-muted`}>{label}</td>
                              <td className={`px-4 py-2 text-right font-semibold tabular-nums ${color}`}>{value}</td>
                              <td className="px-4 py-2 text-right text-muted tabular-nums">
                                {tierBreakdown.total > 0 ? `${((value / tierBreakdown.total) * 100).toFixed(0)}%` : '—'}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-surface/40 border-t border-border/30">
                            <td className="px-4 py-2 font-semibold text-foreground">Total</td>
                            <td className="px-4 py-2 text-right font-bold text-foreground tabular-nums">{tierBreakdown.total}</td>
                            <td className="px-4 py-2 text-right text-muted">100%</td>
                          </tr>
                        </tbody>
                      </table>
                    ) : (
                      <div className="px-4 py-4 text-xs text-muted text-center">Loading…</div>
                    )}
                  </div>
                </div>

                {/* History table */}
                <div>
                  <SectionTitle icon={Calendar} title="30-Day History" />
                  <div className="overflow-x-auto rounded-xl border border-border/30">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-surface/60 border-b border-border/30">
                          {['Date', 'Users', 'New', 'DAU', 'WAU', 'MAU', 'Msgs', 'D1%', 'D7%', 'VIO%'].map(h => (
                            <th key={h} className={clsx('px-3 py-2 text-muted font-medium', h === 'Date' ? 'text-left' : 'text-right')}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {snapshots.slice(0, 30).map((s, i) => (
                          <tr key={s.snapshot_date} className={clsx('border-b border-border/10', i % 2 === 0 ? '' : 'bg-surface/30')}>
                            <td className="px-3 py-1.5 text-foreground">{s.snapshot_date}</td>
                            <td className="px-3 py-1.5 text-right">{s.total_users}</td>
                            <td className="px-3 py-1.5 text-right text-green-400">{s.new_users_today > 0 ? `+${s.new_users_today}` : '0'}</td>
                            <td className="px-3 py-1.5 text-right font-medium">{s.dau}</td>
                            <td className="px-3 py-1.5 text-right">{s.wau}</td>
                            <td className="px-3 py-1.5 text-right">{s.mau}</td>
                            <td className="px-3 py-1.5 text-right">{s.total_messages_today}</td>
                            <td className="px-3 py-1.5 text-right">{s.retention_d1}%</td>
                            <td className="px-3 py-1.5 text-right">{s.retention_d7}%</td>
                            <td className="px-3 py-1.5 text-right">{s.vio_completion_rate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ═══ TAB: PROMO CODES ════════════════════════════════════════════ */}
        {tab === 'promo' && (
          <>
            {/* Live redemptions summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-primary/10 border border-primary/20 p-4">
                <p className="text-[11px] text-muted uppercase tracking-wide mb-1">Active Codes</p>
                <p className="text-2xl font-bold text-foreground">{promoCodes.filter(c => c.is_active).length}</p>
              </div>
              <div className="rounded-2xl bg-surface border border-border/30 p-4">
                <p className="text-[11px] text-muted uppercase tracking-wide mb-1">Total Redemptions</p>
                <p className="text-2xl font-bold text-foreground">
                  {promoCodes.reduce((a, c) => a + c.redemptions_count, 0)}
                </p>
              </div>
            </div>

            {/* Create named code */}
            <div className="rounded-2xl border border-border/30 bg-surface overflow-hidden">
              <button
                onClick={() => setPromoForm(f => ({ ...f, open: !f.open }))}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-foreground"
              >
                <span className="flex items-center gap-2"><Plus className="h-4 w-4 text-primary" /> Create Named Code</span>
                <span className="text-muted text-xs">{promoForm.open ? 'Close' : 'Open'}</span>
              </button>
              {promoForm.open && (
                <div className="px-4 pb-4 space-y-3 border-t border-border/20">
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="text-[11px] text-muted mb-1 block">Code *</label>
                      <input
                        value={promoForm.code}
                        onChange={e => setPromoForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                        placeholder="OLIVE3"
                        className="w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted mb-1 block">Tier</label>
                      <select
                        value={promoForm.tier}
                        onChange={e => setPromoForm(f => ({ ...f, tier: e.target.value }))}
                        className="w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                      >
                        <option value="pro">PRO</option>
                        <option value="master">MASTER</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-muted mb-1 block">Duration</label>
                      <select
                        value={promoForm.days}
                        onChange={e => setPromoForm(f => ({ ...f, days: Number(e.target.value) }))}
                        className="w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                      >
                        <option value={30}>1 month</option>
                        <option value={90}>3 months</option>
                        <option value={180}>6 months</option>
                        <option value={365}>12 months</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-muted mb-1 block">Max Redemptions</label>
                      <input
                        type="number"
                        value={promoForm.maxRedemptions}
                        onChange={e => setPromoForm(f => ({ ...f, maxRedemptions: Number(e.target.value) }))}
                        className="w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted mb-1 block">Code Expires In</label>
                      <select
                        value={promoForm.expiresMonths}
                        onChange={e => setPromoForm(f => ({ ...f, expiresMonths: Number(e.target.value) }))}
                        className="w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                      >
                        <option value={1}>1 month</option>
                        <option value={3}>3 months</option>
                        <option value={6}>6 months</option>
                        <option value={12}>12 months</option>
                        <option value={24}>24 months</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-muted mb-1 block">Notes (optional)</label>
                      <input
                        value={promoForm.notes}
                        onChange={e => setPromoForm(f => ({ ...f, notes: e.target.value }))}
                        placeholder="e.g. Kalamata meeting"
                        className="w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                  {promoError && <p className="text-xs text-red-400">{promoError}</p>}
                  <button
                    onClick={createPromoCode}
                    disabled={promoSaving}
                    className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {promoSaving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Create Code'}
                  </button>
                </div>
              )}
            </div>

            {/* Bulk generator */}
            <div className="rounded-2xl border border-border/30 bg-surface overflow-hidden">
              <button
                onClick={() => setBulkForm(f => ({ ...f, open: !f.open }))}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-foreground"
              >
                <span className="flex items-center gap-2"><Gift className="h-4 w-4 text-primary" /> Generate One-Time Codes (for cards)</span>
                <span className="text-muted text-xs">{bulkForm.open ? 'Close' : 'Open'}</span>
              </button>
              {bulkForm.open && (
                <div className="px-4 pb-4 border-t border-border/20">
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="text-[11px] text-muted mb-1 block">Prefix</label>
                      <input
                        value={bulkForm.prefix}
                        onChange={e => setBulkForm(f => ({ ...f, prefix: e.target.value.toUpperCase() }))}
                        placeholder="O"
                        maxLength={6}
                        className="w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted mb-1 block">Count</label>
                      <input
                        type="number"
                        value={bulkForm.count}
                        min={1} max={1000}
                        onChange={e => setBulkForm(f => ({ ...f, count: Number(e.target.value) }))}
                        className="w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted mb-1 block">Tier</label>
                      <select
                        value={bulkForm.tier}
                        onChange={e => setBulkForm(f => ({ ...f, tier: e.target.value }))}
                        className="w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                      >
                        <option value="pro">PRO</option>
                        <option value="master">MASTER</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-muted mb-1 block">Duration</label>
                      <select
                        value={bulkForm.days}
                        onChange={e => setBulkForm(f => ({ ...f, days: Number(e.target.value) }))}
                        className="w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                      >
                        <option value={30}>1 month</option>
                        <option value={90}>3 months</option>
                        <option value={180}>6 months</option>
                        <option value={365}>12 months</option>
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={generateBulk}
                    disabled={bulkGenerating}
                    className="mt-3 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {bulkGenerating ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : `Generate ${bulkForm.count} codes`}
                  </button>
                  {bulkResult.length > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted">{bulkResult.length} codes generated</span>
                        <button onClick={downloadBulkCodes} className="flex items-center gap-1 text-xs text-primary font-medium">
                          <Download className="h-3 w-3" /> Download .txt
                        </button>
                      </div>
                      <div className="max-h-32 overflow-y-auto rounded-xl bg-background border border-border/30 p-3 font-mono text-xs text-foreground leading-5">
                        {bulkResult.slice(0, 20).join('\n')}
                        {bulkResult.length > 20 && `\n... and ${bulkResult.length - 20} more`}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Codes table */}
            <div>
              <SectionTitle icon={Gift} title={`All Codes (${promoCodes.length})`} />
              <div className="space-y-2">
                {promoCodes.map(c => (
                  <div key={c.code} className={clsx(
                    'rounded-xl border p-3 flex items-start justify-between gap-3',
                    c.is_active ? 'border-border/30 bg-surface' : 'border-border/10 bg-surface/40 opacity-60'
                  )}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold text-foreground">{c.code}</span>
                        <span className="rounded-full bg-primary/10 text-primary text-[10px] px-2 py-0.5 font-medium uppercase">
                          {c.grants_tier}
                        </span>
                        <span className="text-[10px] text-muted">
                          {c.duration_days === 30 ? '1mo' : c.duration_days === 90 ? '3mo' : c.duration_days === 180 ? '6mo' : c.duration_days === 365 ? '12mo' : `${c.duration_days}d`}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-muted flex-wrap">
                        <span>{c.redemptions_count}/{c.max_redemptions ?? '∞'} used</span>
                        {c.expires_at && <span>expires {new Date(c.expires_at).toLocaleDateString()}</span>}
                        {c.notes && <span className="truncate max-w-[160px]">{c.notes}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => togglePromoActive(c.code, c.is_active)}
                      className="flex-shrink-0 p-1.5 rounded-lg text-muted hover:text-foreground transition-colors"
                      title={c.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {c.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent redemptions */}
            {recentRedemptions.length > 0 && (
              <div>
                <SectionTitle icon={Users} title="Recent Redemptions" />
                <div className="overflow-x-auto rounded-xl border border-border/30">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-surface border-b border-border/20">
                        <th className="px-3 py-2 text-left text-muted font-medium">Code</th>
                        <th className="px-3 py-2 text-left text-muted font-medium">Tier</th>
                        <th className="px-3 py-2 text-left text-muted font-medium">Until</th>
                        <th className="px-3 py-2 text-left text-muted font-medium">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentRedemptions.map((r, i) => (
                        <tr key={r.id} className={clsx('border-b border-border/10', i % 2 === 0 ? '' : 'bg-surface/30')}>
                          <td className="px-3 py-1.5 font-mono text-foreground">{r.code}</td>
                          <td className="px-3 py-1.5">
                            <span className="rounded-full bg-primary/10 text-primary text-[10px] px-2 py-0.5 uppercase">
                              {r.granted_tier}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-muted">
                            {new Date(r.granted_until).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-1.5 text-muted">
                            {new Date(r.redeemed_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </main>
  );
}
