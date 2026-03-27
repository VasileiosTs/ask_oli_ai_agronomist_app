import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, TrendingUp, Activity, BarChart3, Target, Zap,
  ArrowUp, ArrowDown, Minus, RefreshCw, Loader2, ShieldAlert,
  ArrowLeft, Calendar
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../lib/LanguageContext';
import clsx from 'clsx';

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
  paying_users: number;
  mrr_cents: number;
  churned_users_30d: number;
  users_with_photos: number;
  users_with_fields: number;
  users_with_interventions: number;
  positive_feedback_count: number;
  negative_feedback_count: number;
}

const translations = {
  el: {
    title: 'Investor Metrics',
    subtitle: 'KPI Dashboard',
    noAccess: 'Δεν έχεις πρόσβαση.',
    noAccessSub: 'Αυτή η σελίδα είναι μόνο για admins.',
    back: 'Αρχική',
    refresh: 'Ανανέωση',
    generating: 'Δημιουργία...',
    noData: 'Δεν υπάρχουν δεδομένα. Κάνε κλικ στο "Ανανέωση" για πρώτο snapshot.',
    users: 'Χρήστες',
    growth: 'Ανάπτυξη',
    engagement: 'Engagement',
    retention: 'Retention',
    vioFunnel: 'VIO Funnel',
    revenue: 'Έσοδα',
    adoption: 'Feature Adoption',
    feedback: 'Feedback',
    daily: 'Ημερήσια Δεδομένα',
    today: 'Σήμερα',
    thisWeek: 'Εβδομάδα',
    thisMonth: 'Μήνας',
    total: 'Σύνολο',
    new: 'Νέοι',
    active: 'Ενεργοί',
    rate: 'Ποσοστό',
    logged: 'Καταχωρήσεις',
    completed: 'Ολοκληρωμένα',
    churned: 'Churned (30d)',
    paying: 'Πληρωτές',
    mrr: 'MRR',
    photos: 'Φωτογραφίες',
    fields: 'Χωράφια',
    interventions: 'Παρεμβάσεις',
    positive: 'Θετικό',
    negative: 'Αρνητικό',
    activation: 'Activation (24h)',
    onboarding: 'Onboarding',
    msgPerUser: 'Msg/User/Day',
    d1: 'D1',
    d7: 'D7',
    d30: 'D30',
    wow: 'WoW',
  },
  en: {
    title: 'Investor Metrics',
    subtitle: 'KPI Dashboard',
    noAccess: 'Access denied.',
    noAccessSub: 'This page is admin-only.',
    back: 'Home',
    refresh: 'Refresh',
    generating: 'Generating...',
    noData: 'No data yet. Click "Refresh" to generate first snapshot.',
    users: 'Users',
    growth: 'Growth',
    engagement: 'Engagement',
    retention: 'Retention',
    vioFunnel: 'VIO Funnel',
    revenue: 'Revenue',
    adoption: 'Feature Adoption',
    feedback: 'Feedback',
    daily: 'Daily Data',
    today: 'Today',
    thisWeek: 'This Week',
    thisMonth: 'This Month',
    total: 'Total',
    new: 'New',
    active: 'Active',
    rate: 'Rate',
    logged: 'Logged',
    completed: 'Completed',
    churned: 'Churned (30d)',
    paying: 'Paying',
    mrr: 'MRR',
    photos: 'Photos',
    fields: 'Fields',
    interventions: 'Interventions',
    positive: 'Positive',
    negative: 'Negative',
    activation: 'Activation (24h)',
    onboarding: 'Onboarding',
    msgPerUser: 'Msg/User/Day',
    d1: 'D1',
    d7: 'D7',
    d30: 'D30',
    wow: 'WoW',
  },
};

function TrendBadge({ current, previous }: { current: number; previous: number }) {
  if (!previous) return <span className="text-xs text-muted">—</span>;
  const pct = ((current - previous) / previous) * 100;
  const isUp = pct > 0;
  const isFlat = Math.abs(pct) < 0.5;
  return (
    <span className={clsx('inline-flex items-center gap-0.5 text-xs font-medium', {
      'text-green-600': isUp && !isFlat,
      'text-red-500': !isUp && !isFlat,
      'text-muted': isFlat,
    })}>
      {isFlat ? <Minus className="h-3 w-3" /> : isUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, subtitle, trend }: {
  icon: typeof Users;
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: { current: number; previous: number };
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm border border-border/30">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <span className="text-xs text-muted font-medium">{label}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-foreground">{value}</span>
        {trend && <TrendBadge current={trend.current} previous={trend.previous} />}
      </div>
      {subtitle && <p className="mt-1 text-xs text-muted">{subtitle}</p>}
    </div>
  );
}

export default function AdminMetrics() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const t = translations[lang as keyof typeof translations] || translations.en;

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [snapshots, setSnapshots] = useState<KpiSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Check admin access
  useEffect(() => {
    if (!user) { setIsAdmin(false); setLoading(false); return; }
    Promise.resolve(supabase.from('admin_users').select('id').eq('auth_id', user.id).maybeSingle())
      .then(({ data }) => {
        setIsAdmin(!!data);
        if (data) loadSnapshots();
        else setLoading(false);
      })
      .catch(() => { setIsAdmin(false); setLoading(false); });
  }, [user]);

  const loadSnapshots = async () => {
    const { data } = await supabase
      .from('kpi_snapshots')
      .select('*')
      .order('snapshot_date', { ascending: false })
      .limit(90);
    if (data) setSnapshots(data as KpiSnapshot[]);
    setLoading(false);
  };

  const triggerSnapshot = async () => {
    setRefreshing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kpi-snapshot`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ date: new Date().toISOString().split('T')[0] }),
        }
      );
      if (res.ok) await loadSnapshots();
    } catch (e) {
      console.error('Snapshot trigger failed:', e);
    }
    setRefreshing(false);
  };

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
        <h1 className="text-xl font-semibold text-foreground mb-2">{t.noAccess}</h1>
        <p className="text-sm text-muted mb-6">{t.noAccessSub}</p>
        <Link to="/" className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-white">
          {t.back}
        </Link>
      </div>
    );
  }

  const today = snapshots[0];
  const yesterday = snapshots[1];

  return (
    <div className="min-h-[100dvh] bg-background pb-12">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl border-b border-border/30 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/profile" className="p-1">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-foreground">{t.title}</h1>
              <p className="text-xs text-muted">{t.subtitle}</p>
            </div>
          </div>
          <button
            onClick={triggerSnapshot}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            <RefreshCw className={clsx('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            {refreshing ? t.generating : t.refresh}
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-6 space-y-6">
        {!today ? (
          <div className="text-center py-12 text-muted text-sm">{t.noData}</div>
        ) : (
          <>
            {/* Date */}
            <div className="flex items-center gap-2 text-xs text-muted">
              <Calendar className="h-3.5 w-3.5" />
              {today.snapshot_date}
            </div>

            {/* ── TOP CARDS: Users & Activity ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard icon={Users} label={t.total + ' ' + t.users} value={today.total_users}
                trend={yesterday ? { current: today.total_users, previous: yesterday.total_users } : undefined} />
              <MetricCard icon={Activity} label="DAU" value={today.dau}
                trend={yesterday ? { current: today.dau, previous: yesterday.dau } : undefined} />
              <MetricCard icon={Activity} label="WAU" value={today.wau}
                trend={yesterday ? { current: today.wau, previous: yesterday.wau } : undefined} />
              <MetricCard icon={Activity} label="MAU" value={today.mau}
                trend={yesterday ? { current: today.mau, previous: yesterday.mau } : undefined} />
            </div>

            {/* ── GROWTH ── */}
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> {t.growth}
              </h2>
              <div className="grid grid-cols-3 gap-3">
                <MetricCard icon={Users} label={t.new + ' ' + t.today} value={today.new_users_today} />
                <MetricCard icon={Users} label={t.new + ' ' + t.thisWeek} value={today.new_users_week} />
                <MetricCard icon={Users} label={t.new + ' ' + t.thisMonth} value={today.new_users_month} />
              </div>
            </div>

            {/* ── ACTIVATION & ONBOARDING ── */}
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" /> {t.activation}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard icon={Zap} label={t.activation} value={`${today.activation_rate_24h}%`} />
                <MetricCard icon={Zap} label={t.onboarding} value={`${today.onboarding_completion_rate}%`} />
                <MetricCard icon={BarChart3} label={t.msgPerUser} value={today.avg_messages_per_active_user} />
                <MetricCard icon={BarChart3} label={t.total + ' Convos'} value={today.total_conversations} />
              </div>
            </div>

            {/* ── RETENTION ── */}
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> {t.retention}
              </h2>
              <div className="grid grid-cols-3 gap-3">
                <MetricCard icon={Target} label={t.d1} value={`${today.retention_d1}%`}
                  subtitle="Day 1 return"
                  trend={yesterday ? { current: today.retention_d1, previous: yesterday.retention_d1 } : undefined} />
                <MetricCard icon={Target} label={t.d7} value={`${today.retention_d7}%`}
                  subtitle="Day 7 return"
                  trend={yesterday ? { current: today.retention_d7, previous: yesterday.retention_d7 } : undefined} />
                <MetricCard icon={Target} label={t.d30} value={`${today.retention_d30}%`}
                  subtitle="Day 30 return"
                  trend={yesterday ? { current: today.retention_d30, previous: yesterday.retention_d30 } : undefined} />
              </div>
            </div>

            {/* ── VIO FUNNEL ── */}
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" /> {t.vioFunnel}
              </h2>
              <div className="grid grid-cols-3 gap-3">
                <MetricCard icon={BarChart3} label={t.logged} value={today.vio_logged_count} />
                <MetricCard icon={BarChart3} label={t.completed} value={today.vio_completed_count} />
                <MetricCard icon={BarChart3} label={t.rate} value={`${today.vio_completion_rate}%`} />
              </div>
            </div>

            {/* ── FEATURE ADOPTION ── */}
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" /> {t.adoption}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard icon={Zap} label={t.photos} value={today.users_with_photos}
                  subtitle={`${today.total_users ? ((today.users_with_photos / today.total_users) * 100).toFixed(0) : 0}% of users`} />
                <MetricCard icon={Zap} label={t.fields} value={today.users_with_fields} />
                <MetricCard icon={Zap} label={t.interventions} value={today.users_with_interventions} />
                <MetricCard icon={Zap} label={t.feedback}
                  value={`${today.positive_feedback_count} / ${today.negative_feedback_count}`}
                  subtitle={`${t.positive} / ${t.negative}`} />
              </div>
            </div>

            {/* ── REVENUE (placeholder) ── */}
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> {t.revenue}
              </h2>
              <div className="grid grid-cols-3 gap-3">
                <MetricCard icon={Users} label={t.paying} value={today.paying_users} />
                <MetricCard icon={TrendingUp} label={t.mrr}
                  value={`€${(today.mrr_cents / 100).toFixed(2)}`} />
                <MetricCard icon={Activity} label={t.churned} value={today.churned_users_30d} />
              </div>
            </div>

            {/* ── DAILY HISTORY TABLE ── */}
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-3">{t.daily}</h2>
              <div className="overflow-x-auto rounded-xl border border-border/30">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-white/60">
                      <th className="px-3 py-2 text-left text-muted font-medium">Date</th>
                      <th className="px-3 py-2 text-right text-muted font-medium">{t.users}</th>
                      <th className="px-3 py-2 text-right text-muted font-medium">{t.new}</th>
                      <th className="px-3 py-2 text-right text-muted font-medium">DAU</th>
                      <th className="px-3 py-2 text-right text-muted font-medium">WAU</th>
                      <th className="px-3 py-2 text-right text-muted font-medium">MAU</th>
                      <th className="px-3 py-2 text-right text-muted font-medium">Msgs</th>
                      <th className="px-3 py-2 text-right text-muted font-medium">D1%</th>
                      <th className="px-3 py-2 text-right text-muted font-medium">D7%</th>
                      <th className="px-3 py-2 text-right text-muted font-medium">VIO%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.slice(0, 30).map((s, i) => (
                      <tr key={s.snapshot_date} className={i % 2 === 0 ? 'bg-white/30' : ''}>
                        <td className="px-3 py-1.5 text-foreground">{s.snapshot_date}</td>
                        <td className="px-3 py-1.5 text-right">{s.total_users}</td>
                        <td className="px-3 py-1.5 text-right">{s.new_users_today}</td>
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
      </div>
    </div>
  );
}
